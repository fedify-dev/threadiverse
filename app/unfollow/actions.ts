"use server";

import { Follow, Undo } from "@fedify/vocab";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, follows } from "@/db";
import federation from "@/federation";
import { currentOrigin } from "@/lib/origin";
import { getCurrentUser } from "@/lib/session";

export async function unfollowCommunity(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const followedUri = String(formData.get("followedUri") ?? "").trim();
  if (!followedUri) redirect("/");

  const origin = await currentOrigin();
  const ctx = federation.createContext(origin, undefined);
  const followerUri = ctx.getActorUri(user.username);

  const row = db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.followerUri, followerUri.href),
        eq(follows.followedUri, followedUri),
      ),
    )
    .get();
  if (!row) redirect("/");

  const undoActivityUri = new URL(
    `/users/${user.username}/undoes/${Date.now()}`,
    origin,
  );

  await ctx.sendActivity(
    { identifier: user.username },
    { id: new URL(followedUri), inboxId: new URL(row.followerInbox) },
    new Undo({
      id: undoActivityUri,
      actor: followerUri,
      object: new Follow({
        id: new URL(`#follow-undo/${row.id}`, followerUri),
        actor: followerUri,
        object: new URL(followedUri),
      }),
    }),
  );

  db.delete(follows)
    .where(
      and(
        eq(follows.followerUri, followerUri.href),
        eq(follows.followedUri, followedUri),
      ),
    )
    .run();

  redirect("/");
}
