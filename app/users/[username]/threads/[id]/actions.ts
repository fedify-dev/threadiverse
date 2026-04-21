"use server";

import { Create, Note, PUBLIC_COLLECTION } from "@fedify/vocab";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { communities, db, replies, threads } from "@/db";
import federation from "@/federation";
import { currentOrigin } from "@/lib/origin";
import { getCurrentUser } from "@/lib/session";

export async function createReply(
  slug: string,
  threadId: string,
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?message=Log+in+to+reply");

  const community = db
    .select()
    .from(communities)
    .where(eq(communities.slug, slug))
    .get();
  if (!community) redirect(`/users/${slug}`);

  const origin = await currentOrigin();
  const threadUri = new URL(`/users/${slug}/threads/${threadId}`, origin).href;
  const thread = db
    .select()
    .from(threads)
    .where(eq(threads.uri, threadUri))
    .get();
  if (!thread) redirect(`/users/${slug}/threads/${threadId}`);

  const content = String(formData.get("content") ?? "").trim();
  const parentUri = String(formData.get("parentUri") ?? "").trim() || null;
  if (!content) {
    redirect(`/users/${slug}/threads/${threadId}?error=Reply+cannot+be+empty`);
  }

  const ctx = federation.createContext(origin, undefined);
  const authorUri = ctx.getActorUri(user.username);
  const communityActorUri = ctx.getActorUri(slug);
  const communityFollowersUri = ctx.getFollowersUri(slug);
  const published = new Date();

  const inserted = db
    .insert(replies)
    .values({
      uri: `urn:threadiverse:pending:${Date.now()}`,
      threadUri,
      parentUri,
      communityUri: communityActorUri.href,
      authorUri: authorUri.href,
      content,
      createdAt: published,
    })
    .returning({ id: replies.id })
    .get();

  const replyUri = new URL(
    `/users/${slug}/threads/${threadId}/replies/${inserted.id}`,
    origin,
  );
  db.update(replies)
    .set({ uri: replyUri.href })
    .where(eq(replies.id, inserted.id))
    .run();

  const note = new Note({
    id: replyUri,
    content,
    attribution: authorUri,
    audience: communityActorUri,
    replyTarget: new URL(parentUri ?? threadUri),
    tos: [communityActorUri],
    ccs: [PUBLIC_COLLECTION, communityFollowersUri],
  });

  await ctx.sendActivity(
    { identifier: user.username },
    {
      id: communityActorUri,
      inboxId: ctx.getInboxUri(slug),
      endpoints: { sharedInbox: ctx.getInboxUri() },
    },
    new Create({
      id: new URL("#create", replyUri),
      actor: authorUri,
      object: note,
      tos: [communityActorUri],
      ccs: [PUBLIC_COLLECTION, communityFollowersUri],
    }),
  );

  redirect(`/users/${slug}/threads/${threadId}`);
}
