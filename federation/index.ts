import {
  createFederation,
  exportJwk,
  generateCryptoKeyPair,
  getDocumentLoader,
  type InboxContext,
  InProcessMessageQueue,
  importJwk,
  MemoryKvStore,
} from "@fedify/fedify";
import {
  Accept,
  Activity,
  Announce,
  Create,
  Dislike,
  Endpoints,
  Follow,
  Group,
  Like,
  Note,
  Page,
  Person,
  PUBLIC_COLLECTION,
  Undo,
} from "@fedify/vocab";
import { and, eq } from "drizzle-orm";
import {
  communities,
  db,
  follows,
  keys,
  replies,
  threads,
  users,
  votes,
} from "@/db";
import lemmyContext from "./lemmy-context.json" with { type: "json" };

const BUNDLED_CONTEXTS: Record<string, unknown> = {
  "https://join-lemmy.org/context.json": lemmyContext,
};

const documentLoaderFactory: Parameters<
  typeof createFederation
>[0]["documentLoaderFactory"] = (options) => {
  const inner = getDocumentLoader(options);
  return async (url) => {
    const bundled = BUNDLED_CONTEXTS[url];
    if (bundled != null) {
      return { contextUrl: null, document: bundled, documentUrl: url };
    }
    return await inner(url);
  };
};

const federation = createFederation({
  kv: new MemoryKvStore(),
  queue: new InProcessMessageQueue(),
  documentLoaderFactory,
  contextLoaderFactory: documentLoaderFactory,
});

federation
  .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    const user = db
      .select()
      .from(users)
      .where(eq(users.username, identifier))
      .get();
    if (user) {
      const keyPairs = await ctx.getActorKeyPairs(identifier);
      return new Person({
        id: ctx.getActorUri(identifier),
        preferredUsername: identifier,
        name: identifier,
        inbox: ctx.getInboxUri(identifier),
        outbox: ctx.getOutboxUri(identifier),
        endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
        url: new URL(`/users/${identifier}`, ctx.url),
        publicKey: keyPairs[0]?.cryptographicKey,
        assertionMethods: keyPairs.map((k) => k.multikey),
      });
    }

    const community = db
      .select()
      .from(communities)
      .where(eq(communities.slug, identifier))
      .get();
    if (community) {
      const keyPairs = await ctx.getActorKeyPairs(identifier);
      return new Group({
        id: ctx.getActorUri(identifier),
        preferredUsername: identifier,
        name: community.name,
        summary: community.description || undefined,
        inbox: ctx.getInboxUri(identifier),
        outbox: ctx.getOutboxUri(identifier),
        endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
        followers: ctx.getFollowersUri(identifier),
        featured: new URL(`/users/${identifier}/featured`, ctx.url),
        attribution: ctx.getCollectionUri("moderators", { identifier }),
        url: new URL(`/users/${identifier}`, ctx.url),
        publicKey: keyPairs[0]?.cryptographicKey,
        assertionMethods: keyPairs.map((k) => k.multikey),
      });
    }

    return null;
  })
  .setKeyPairsDispatcher(async (_ctx, identifier) => {
    const user = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, identifier))
      .get();
    const community = user
      ? null
      : db
          .select({ id: communities.id })
          .from(communities)
          .where(eq(communities.slug, identifier))
          .get();
    if (!user && !community) return [];

    const pairs: CryptoKeyPair[] = [];
    for (const keyType of ["RSASSA-PKCS1-v1_5", "Ed25519"] as const) {
      const existing = db
        .select()
        .from(keys)
        .where(
          and(eq(keys.actorIdentifier, identifier), eq(keys.type, keyType)),
        )
        .get();
      if (existing) {
        pairs.push({
          privateKey: await importJwk(
            JSON.parse(existing.privateKey),
            "private",
          ),
          publicKey: await importJwk(JSON.parse(existing.publicKey), "public"),
        });
      } else {
        const pair = await generateCryptoKeyPair(keyType);
        db.insert(keys)
          .values({
            actorIdentifier: identifier,
            type: keyType,
            privateKey: JSON.stringify(await exportJwk(pair.privateKey)),
            publicKey: JSON.stringify(await exportJwk(pair.publicKey)),
          })
          .run();
        pairs.push(pair);
      }
    }
    return pairs;
  });

federation.setOutboxDispatcher(
  "/users/{identifier}/outbox",
  async (_ctx, _identifier) => ({ items: [] }),
);

federation.setOrderedCollectionDispatcher(
  "moderators",
  Person,
  "/users/{identifier}/moderators",
  async (ctx, { identifier }) => {
    const row = db
      .select({ username: users.username })
      .from(communities)
      .innerJoin(users, eq(users.id, communities.creatorId))
      .where(eq(communities.slug, identifier))
      .get();
    if (!row) return null;
    return {
      items: [new Person({ id: ctx.getActorUri(row.username) })],
    };
  },
);

federation.setFeaturedDispatcher(
  "/users/{identifier}/featured",
  async (_ctx, _identifier) => ({ items: [] }),
);

federation.setFollowersDispatcher(
  "/users/{identifier}/followers",
  async (ctx, identifier) => {
    const community = db
      .select()
      .from(communities)
      .where(eq(communities.slug, identifier))
      .get();
    if (!community) return null;
    const rows = db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followedUri, ctx.getActorUri(identifier).href),
          eq(follows.accepted, true),
        ),
      )
      .all();
    return {
      items: rows.map((r) => ({
        id: new URL(r.followerUri),
        inboxId: new URL(r.followerInbox),
        endpoints: r.followerSharedInbox
          ? { sharedInbox: new URL(r.followerSharedInbox) }
          : null,
      })),
    };
  },
);

federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (!follow.id || !follow.actorId || !follow.objectId) return;
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor") return;
    const identifier = parsed.identifier;

    const community = db
      .select()
      .from(communities)
      .where(eq(communities.slug, identifier))
      .get();
    if (!community) return;

    const actor = await follow.getActor(ctx);
    if (!actor?.id || !actor.inboxId) return;

    db.insert(follows)
      .values({
        followerUri: actor.id.href,
        followerInbox: actor.inboxId.href,
        followerSharedInbox: actor.endpoints?.sharedInbox?.href ?? null,
        followedUri: follow.objectId.href,
        accepted: true,
      })
      .onConflictDoUpdate({
        target: [follows.followerUri, follows.followedUri],
        set: {
          followerInbox: actor.inboxId.href,
          followerSharedInbox: actor.endpoints?.sharedInbox?.href ?? null,
          accepted: true,
        },
      })
      .run();

    await ctx.sendActivity(
      { identifier },
      actor,
      new Accept({
        id: new URL(
          `/users/${identifier}/accepts/${crypto.randomUUID()}`,
          ctx.getActorUri(identifier),
        ),
        actor: follow.objectId,
        object: new Follow({
          id: follow.id,
          actor: follow.actorId,
          object: follow.objectId,
        }),
      }),
    );
  })
  .on(Accept, async (ctx, accept) => {
    if (!accept.actorId) return;
    const followedUri = accept.actorId.href;

    let followerUri: string | null = null;
    const enclosed = await accept.getObject(ctx).catch(() => null);
    if (enclosed instanceof Follow && enclosed.actorId) {
      followerUri = enclosed.actorId.href;
    }

    if (followerUri) {
      db.update(follows)
        .set({ accepted: true })
        .where(
          and(
            eq(follows.followerUri, followerUri),
            eq(follows.followedUri, followedUri),
          ),
        )
        .run();
    } else {
      db.update(follows)
        .set({ accepted: true })
        .where(eq(follows.followedUri, followedUri))
        .run();
    }
  })
  .on(Undo, async (ctx, undo) => {
    const enclosed = await undo.getObject(ctx);
    if (!(enclosed instanceof Follow)) return;
    if (!enclosed.actorId || !enclosed.objectId) return;
    if (undo.actorId?.href !== enclosed.actorId.href) return;
    db.delete(follows)
      .where(
        and(
          eq(follows.followerUri, enclosed.actorId.href),
          eq(follows.followedUri, enclosed.objectId.href),
        ),
      )
      .run();
  })
  .on(Create, async (ctx, create) => {
    if (!create.actorId) return;
    const object = await create.getObject(ctx);
    if (!object?.id) return;

    let communityUri: URL | null = null;

    if (object instanceof Page) {
      communityUri = object.audienceId ?? create.toIds[0] ?? null;
      if (!communityUri) return;
      db.insert(threads)
        .values({
          uri: object.id.href,
          communityUri: communityUri.href,
          authorUri: create.actorId.href,
          title: object.name?.toString() ?? "(untitled)",
          content: object.content?.toString() ?? "",
          createdAt: object.published
            ? new Date(object.published.epochMilliseconds)
            : new Date(),
        })
        .onConflictDoNothing()
        .run();
    } else if (object instanceof Note) {
      communityUri = object.audienceId ?? create.toIds[0] ?? null;
      const inReplyTo = object.replyTargetId;
      if (!communityUri || !inReplyTo) return;
      const parentThread = db
        .select({ uri: threads.uri })
        .from(threads)
        .where(eq(threads.uri, inReplyTo.href))
        .get();
      const parentReply = parentThread
        ? null
        : db
            .select({ uri: replies.uri, threadUri: replies.threadUri })
            .from(replies)
            .where(eq(replies.uri, inReplyTo.href))
            .get();
      const threadUri = parentThread?.uri ?? parentReply?.threadUri;
      if (!threadUri) return;
      db.insert(replies)
        .values({
          uri: object.id.href,
          threadUri,
          parentUri: parentReply ? inReplyTo.href : null,
          communityUri: communityUri.href,
          authorUri: create.actorId.href,
          content: object.content?.toString() ?? "",
          createdAt: object.published
            ? new Date(object.published.epochMilliseconds)
            : new Date(),
        })
        .onConflictDoNothing()
        .run();
    } else {
      return;
    }

    const parsed = ctx.parseUri(communityUri);
    if (parsed?.type !== "actor") return;
    const localCommunity = db
      .select({ slug: communities.slug })
      .from(communities)
      .where(eq(communities.slug, parsed.identifier))
      .get();
    if (!localCommunity) return;

    await ctx.sendActivity(
      { identifier: parsed.identifier },
      "followers",
      new Announce({
        id: new URL(
          `/users/${parsed.identifier}/announces/${crypto.randomUUID()}`,
          ctx.getActorUri(parsed.identifier),
        ),
        actor: communityUri,
        object: create,
        tos: [PUBLIC_COLLECTION],
        ccs: [ctx.getFollowersUri(parsed.identifier)],
      }),
      { preferSharedInbox: false },
    );
  })
  .on(Announce, async (ctx, announce) => {
    const object = await announce.getObject(ctx);
    if (object instanceof Activity) {
      await ctx.routeActivity(ctx.recipient, object);
    }
  })
  .on(Like, async (ctx, like) => {
    await handleVote(ctx, like, "Like");
  })
  .on(Dislike, async (ctx, dislike) => {
    await handleVote(ctx, dislike, "Dislike");
  });

async function handleVote(
  ctx: InboxContext<unknown>,
  activity: Like | Dislike,
  kind: "Like" | "Dislike",
): Promise<void> {
  if (!activity.id || !activity.actorId || !activity.objectId) return;
  const targetUri = activity.objectId.href;
  const communityUri = activity.audienceId ?? activity.toIds[0] ?? null;
  if (!communityUri) return;

  const targetThread = db
    .select({ uri: threads.uri })
    .from(threads)
    .where(eq(threads.uri, targetUri))
    .get();
  const targetReply = targetThread
    ? null
    : db
        .select({ uri: replies.uri })
        .from(replies)
        .where(eq(replies.uri, targetUri))
        .get();
  if (!targetThread && !targetReply) return;

  db.insert(votes)
    .values({
      uri: activity.id.href,
      voterUri: activity.actorId.href,
      targetUri,
      kind,
      communityUri: communityUri.href,
    })
    .onConflictDoUpdate({
      target: [votes.voterUri, votes.targetUri],
      set: { kind, uri: activity.id.href },
    })
    .run();

  const parsed = ctx.parseUri(communityUri);
  if (parsed?.type !== "actor") return;
  const localCommunity = db
    .select({ slug: communities.slug })
    .from(communities)
    .where(eq(communities.slug, parsed.identifier))
    .get();
  if (!localCommunity) return;

  await ctx.sendActivity(
    { identifier: parsed.identifier },
    "followers",
    new Announce({
      id: new URL(
        `#announce/${encodeURIComponent(activity.id.href)}`,
        communityUri,
      ),
      actor: communityUri,
      object: activity,
      tos: [ctx.getFollowersUri(parsed.identifier)],
      ccs: [PUBLIC_COLLECTION],
    }),
    { preferSharedInbox: true },
  );
}

export default federation;
