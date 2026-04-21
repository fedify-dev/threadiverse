import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { communities, db, threads } from "@/db";
import { currentOrigin } from "@/lib/origin";

type ThreadPageProps = {
  params: Promise<{ username: string; id: string }>;
};

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { username: slug, id: idParam } = await params;
  const community = db
    .select()
    .from(communities)
    .where(eq(communities.slug, slug))
    .get();
  if (!community) notFound();

  const origin = await currentOrigin();
  const threadUri = new URL(`/users/${slug}/threads/${idParam}`, origin).href;

  const thread = db
    .select()
    .from(threads)
    .where(eq(threads.uri, threadUri))
    .get();
  if (!thread) notFound();

  return (
    <>
      <p className="muted">
        In <a href={`/users/${slug}`}>!{slug}</a>
      </p>
      <h1>{thread.title}</h1>
      <p className="muted">
        Posted {thread.createdAt.toLocaleString("en-US")} by{" "}
        <code>{thread.authorUri}</code>
      </p>
      {thread.content && (
        <div className="card">
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{thread.content}</p>
        </div>
      )}
      <p className="muted">Replies will appear here in the next commit.</p>
    </>
  );
}
