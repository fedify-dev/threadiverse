"use server";

import { Follow, Group, isActor } from "@fedify/vocab";
import { redirect } from "next/navigation";
import { db, follows } from "@/db";
import federation from "@/federation";
import { currentOrigin } from "@/lib/origin";
import { getCurrentUser } from "@/lib/session";

export async function followCommunity(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?message=Log+in+to+follow+a+community");

  const handle = String(formData.get("handle") ?? "").trim();
  if (!handle) {
    redirect("/follow?error=Handle+is+required");
  }

  const origin = await currentOrigin();
  const ctx = federation.createContext(origin, undefined);

  const actor = await ctx.lookupObject(handle);
  if (!isActor(actor) || !actor.id || !actor.inboxId) {
    redirect("/follow?error=Could+not+resolve+that+handle");
  }
  if (!(actor instanceof Group)) {
    redirect(
      `/follow?error=${encodeURIComponent(
        "That actor isn't a community; only Group actors can be followed here.",
      )}`,
    );
  }

  const followerUri = ctx.getActorUri(user.username);
  const followerInbox = ctx.getInboxUri(user.username);
  const sharedInbox = ctx.getInboxUri();

  db.insert(follows)
    .values({
      followerUri: followerUri.href,
      followerInbox: followerInbox.href,
      followerSharedInbox: sharedInbox.href,
      followedUri: actor.id.href,
      accepted: false,
    })
    .onConflictDoNothing()
    .run();

  await ctx.sendActivity(
    { identifier: user.username },
    actor,
    new Follow({
      id: new URL(`#follow/${Date.now()}`, followerUri),
      actor: followerUri,
      object: actor.id,
    }),
  );

  redirect(
    `/follow?message=${encodeURIComponent(
      `Follow request sent to ${handle}. It will show as accepted once the remote server confirms.`,
    )}`,
  );
}
