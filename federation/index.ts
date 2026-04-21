import {
  createFederation,
  exportJwk,
  generateCryptoKeyPair,
  InProcessMessageQueue,
  importJwk,
  MemoryKvStore,
} from "@fedify/fedify";
import { Endpoints, Group, Person } from "@fedify/vocab";
import { and, eq } from "drizzle-orm";
import { communities, db, follows, keys, users } from "@/db";

const federation = createFederation({
  kv: new MemoryKvStore(),
  queue: new InProcessMessageQueue(),
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
        endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
        followers: ctx.getFollowersUri(identifier),
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

federation.setInboxListeners("/users/{identifier}/inbox", "/inbox");

export default federation;
