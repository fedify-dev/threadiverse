"use server";

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
  const communityUri = ctx.getActorUri(slug).href;
  const authorUri = ctx.getActorUri(user.username).href;

  const inserted = db
    .insert(threads)
    .values({
      uri: "placeholder",
      communityUri,
      authorUri,
      title,
      content,
    })
    .returning({ id: threads.id })
    .get();

  const uri = new URL(`/users/${slug}/threads/${inserted.id}`, origin).href;
  db.update(threads).set({ uri }).where(eq(threads.id, inserted.id)).run();

  redirect(`/users/${slug}`);
}
