"use server";

import { Dislike, Like, PUBLIC_COLLECTION } from "@fedify/vocab";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { communities, db, votes } from "@/db";
import federation from "@/federation";
import { currentOrigin } from "@/lib/origin";
import { getCurrentUser } from "@/lib/session";

export async function castVote(
  slug: string,
  threadId: string,
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?message=Log+in+to+vote");

  const community = db
    .select()
    .from(communities)
    .where(eq(communities.slug, slug))
    .get();
  if (!community) redirect(`/users/${slug}`);

  const targetUri = String(formData.get("targetUri") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as "Like" | "Dislike";
  if (!targetUri) redirect(`/users/${slug}/threads/${threadId}`);
  if (kind !== "Like" && kind !== "Dislike") {
    redirect(`/users/${slug}/threads/${threadId}`);
  }

  const origin = await currentOrigin();
  const ctx = federation.createContext(origin, undefined);
  const voterUri = ctx.getActorUri(user.username);
  const communityActorUri = ctx.getActorUri(slug);
  const communityFollowersUri = ctx.getFollowersUri(slug);
  const voteActivityUri = new URL(
    `/users/${user.username}/votes/${Date.now()}`,
    origin,
  );

  db.insert(votes)
    .values({
      uri: voteActivityUri.href,
      voterUri: voterUri.href,
      targetUri,
      kind,
      communityUri: communityActorUri.href,
    })
    .onConflictDoUpdate({
      target: [votes.voterUri, votes.targetUri],
      set: { kind, uri: voteActivityUri.href },
    })
    .run();

  const VoteClass = kind === "Like" ? Like : Dislike;
  await ctx.sendActivity(
    { identifier: user.username },
    {
      id: communityActorUri,
      inboxId: ctx.getInboxUri(slug),
      endpoints: { sharedInbox: ctx.getInboxUri() },
    },
    new VoteClass({
      id: voteActivityUri,
      actor: voterUri,
      object: new URL(targetUri),
      audience: communityActorUri,
      tos: [communityActorUri],
      ccs: [PUBLIC_COLLECTION, communityFollowersUri],
    }),
  );

  redirect(`/users/${slug}/threads/${threadId}`);
}
