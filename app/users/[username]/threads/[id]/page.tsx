import { asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { communities, db, replies, threads, votes } from "@/db";
import { currentOrigin } from "@/lib/origin";
import { getCurrentUser } from "@/lib/session";
import { createReply } from "./actions";
import { castVote } from "./vote-actions";

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

type VoteTally = {
  likes: number;
  dislikes: number;
  myVote: "Like" | "Dislike" | null;
};

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

  const voteTargets = [threadUri, ...replyRows.map((r) => r.uri)];
  const voteRows = db
    .select()
    .from(votes)
    .where(inArray(votes.targetUri, voteTargets))
    .all();
  const myVoterUri = user
    ? new URL(`/users/${user.username}`, origin).href
    : null;
  const tallies = new Map<string, VoteTally>();
  for (const v of voteRows) {
    const t = tallies.get(v.targetUri) ?? {
      likes: 0,
      dislikes: 0,
      myVote: null,
    };
    if (v.kind === "Like") t.likes++;
    else t.dislikes++;
    if (v.voterUri === myVoterUri) t.myVote = v.kind;
    tallies.set(v.targetUri, t);
  }

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
      <VoteButtons
        targetUri={threadUri}
        slug={slug}
        threadId={idParam}
        tally={tallies.get(threadUri)}
        canVote={user != null}
      />

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
          tallies={tallies}
        />
      )}
    </>
  );
}

function VoteButtons({
  targetUri,
  slug,
  threadId,
  tally,
  canVote,
}: {
  targetUri: string;
  slug: string;
  threadId: string;
  tally: VoteTally | undefined;
  canVote: boolean;
}) {
  const likes = tally?.likes ?? 0;
  const dislikes = tally?.dislikes ?? 0;
  const mine = tally?.myVote ?? null;
  if (!canVote) {
    return (
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        ▲ {likes} &nbsp; ▼ {dislikes}
      </p>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        marginTop: "0.5rem",
      }}
    >
      <form action={castVote.bind(null, slug, threadId)}>
        <input type="hidden" name="targetUri" value={targetUri} />
        <input type="hidden" name="kind" value="Like" />
        <button
          type="submit"
          className={mine === "Like" ? "" : "link-button"}
          style={{ margin: 0 }}
        >
          ▲ {likes}
        </button>
      </form>
      <form action={castVote.bind(null, slug, threadId)}>
        <input type="hidden" name="targetUri" value={targetUri} />
        <input type="hidden" name="kind" value="Dislike" />
        <button
          type="submit"
          className={mine === "Dislike" ? "" : "link-button"}
          style={{ margin: 0 }}
        >
          ▼ {dislikes}
        </button>
      </form>
    </div>
  );
}

function ReplyList({
  nodes,
  slug,
  threadId,
  user,
  tallies,
}: {
  nodes: ReplyNode[];
  slug: string;
  threadId: string;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  tallies: Map<string, VoteTally>;
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
            <VoteButtons
              targetUri={node.uri}
              slug={slug}
              threadId={threadId}
              tally={tallies.get(node.uri)}
              canVote={user != null}
            />
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
              tallies={tallies}
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
      roots.push(node);
    }
  }
  return roots;
}
