import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { communities, db, replies, threads } from "@/db";
import { currentOrigin } from "@/lib/origin";
import { getCurrentUser } from "@/lib/session";
import { createReply } from "./actions";

type ThreadPageProps = {
  params: Promise<{ username: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type ReplyRow = {
  id: number;
  uri: string;
  parentUri: string | null;
  authorUri: string;
  content: string;
  createdAt: Date;
};

type ReplyNode = ReplyRow & { children: ReplyNode[] };

export default async function ThreadPage({
  params,
  searchParams,
}: ThreadPageProps) {
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

  const { error } = await searchParams;
  const user = await getCurrentUser();

  const replyRows = db
    .select({
      id: replies.id,
      uri: replies.uri,
      parentUri: replies.parentUri,
      authorUri: replies.authorUri,
      content: replies.content,
      createdAt: replies.createdAt,
    })
    .from(replies)
    .where(eq(replies.threadUri, threadUri))
    .orderBy(asc(replies.createdAt))
    .all();
  const replyTree = buildReplyTree(replyRows, threadUri);

  return (
    <>
      <p className="muted">
        In <Link href={`/users/${slug}`}>!{slug}</Link>
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

      <h3>Replies</h3>
      {error && <p className="muted">{error}</p>}
      {user && (
        <form action={createReply.bind(null, slug, idParam)}>
          <label>
            Your reply
            <textarea name="content" rows={4} required />
          </label>
          <button type="submit">Reply to thread</button>
        </form>
      )}

      {replyTree.length === 0 ? (
        <p className="muted">No replies yet.</p>
      ) : (
        <ReplyList
          nodes={replyTree}
          slug={slug}
          threadId={idParam}
          user={user}
        />
      )}
    </>
  );
}

function ReplyList({
  nodes,
  slug,
  threadId,
  user,
}: {
  nodes: ReplyNode[];
  slug: string;
  threadId: string;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
}) {
  return (
    <ul className="reply-tree">
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="card">
            <p className="muted" style={{ marginTop: 0 }}>
              <code>{node.authorUri}</code> ·{" "}
              {node.createdAt.toLocaleString("en-US")}
            </p>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{node.content}</p>
            {user && (
              <details style={{ marginTop: "0.5rem" }}>
                <summary className="muted">Reply</summary>
                <form action={createReply.bind(null, slug, threadId)}>
                  <input type="hidden" name="parentUri" value={node.uri} />
                  <label>
                    Your reply
                    <textarea name="content" rows={3} required />
                  </label>
                  <button type="submit">Post reply</button>
                </form>
              </details>
            )}
          </div>
          {node.children.length > 0 && (
            <ReplyList
              nodes={node.children}
              slug={slug}
              threadId={threadId}
              user={user}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function buildReplyTree(rows: ReplyRow[], threadUri: string): ReplyNode[] {
  const byUri = new Map<string, ReplyNode>();
  const roots: ReplyNode[] = [];
  for (const row of rows) {
    byUri.set(row.uri, { ...row, children: [] });
  }
  for (const node of byUri.values()) {
    const parent = node.parentUri ? byUri.get(node.parentUri) : undefined;
    if (parent) parent.children.push(node);
    else if (node.parentUri == null || node.parentUri === threadUri) {
      roots.push(node);
    } else {
      // Orphaned reply: its parent didn't land yet. Show at top level.
      roots.push(node);
    }
  }
  return roots;
}
