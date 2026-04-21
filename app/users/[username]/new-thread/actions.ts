"use server";

import { Create, Page, PUBLIC_COLLECTION } from "@fedify/vocab";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { communities, db, threads } from "@/db";
import federation from "@/federation";
import { currentOrigin } from "@/lib/origin";
import { getCurrentUser } from "@/lib/session";

export async function createThread(
  slug: string,
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?message=Log+in+to+start+a+thread");

  const community = db
    .select()
    .from(communities)
    .where(eq(communities.slug, slug))
    .get();
  if (!community) redirect(`/users/${slug}?error=No+such+community`);

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title) redirect(`/users/${slug}/new-thread?error=Title+is+required`);

  const origin = await currentOrigin();
  const ctx = federation.createContext(origin, undefined);
  const communityActorUri = ctx.getActorUri(slug);
  const communityFollowersUri = ctx.getFollowersUri(slug);
  const authorUri = ctx.getActorUri(user.username);
  const published = new Date();

  const inserted = db
    .insert(threads)
    .values({
      uri: `urn:threadiverse:pending:${Date.now()}`,
      communityUri: communityActorUri.href,
      authorUri: authorUri.href,
      title,
      content,
      createdAt: published,
    })
    .returning({ id: threads.id })
    .get();

  const threadUri = new URL(`/users/${slug}/threads/${inserted.id}`, origin);
  db.update(threads)
    .set({ uri: threadUri.href })
    .where(eq(threads.id, inserted.id))
    .run();

  const page = new Page({
    id: threadUri,
    name: title,
    content: content || undefined,
    attribution: authorUri,
    audience: communityActorUri,
    tos: [PUBLIC_COLLECTION],
    ccs: [communityActorUri, communityFollowersUri],
  });

  await ctx.sendActivity(
    { identifier: user.username },
    {
      id: communityActorUri,
      inboxId: ctx.getInboxUri(slug),
      endpoints: { sharedInbox: ctx.getInboxUri() },
    },
    new Create({
      id: new URL("#create", threadUri),
      actor: authorUri,
      object: page,
      tos: [PUBLIC_COLLECTION],
      ccs: [communityActorUri, communityFollowersUri],
    }),
  );

  redirect(`/users/${slug}`);
}
