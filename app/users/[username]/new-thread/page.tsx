import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { communities, db } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { createThread } from "./actions";

type NewThreadPageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function NewThreadPage({
  params,
  searchParams,
}: NewThreadPageProps) {
  const { username: slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login?message=Log+in+to+start+a+thread");

  const community = db
    .select()
    .from(communities)
    .where(eq(communities.slug, slug))
    .get();
  if (!community) notFound();

  const { error } = await searchParams;
  return (
    <>
      <h1>New thread in !{community.slug}</h1>
      {error && <p className="muted">{error}</p>}
      <form action={createThread.bind(null, slug)}>
        <label>
          Title
          <input type="text" name="title" required maxLength={200} />
        </label>
        <label>
          Body
          <textarea name="content" rows={8} />
        </label>
        <button type="submit">Post thread</button>
      </form>
    </>
  );
}
