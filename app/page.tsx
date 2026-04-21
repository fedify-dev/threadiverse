import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db, follows, threads } from "@/db";
import { currentOrigin } from "@/lib/origin";
import { getCurrentUser } from "@/lib/session";
import { unfollowCommunity } from "./unfollow/actions";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <h1>Welcome to Threadiverse</h1>
        <p>
          A small federated community platform built with Fedify and Next.js.
        </p>
        <p>
          <Link href="/signup" className="button">
            Sign up
          </Link>{" "}
          <Link href="/login">or log in</Link>.
        </p>
      </>
    );
  }

  const origin = await currentOrigin();
  const viewerUri = new URL(`/users/${user.username}`, origin).href;

  const subscribed = db
    .select({
      followedUri: follows.followedUri,
      accepted: follows.accepted,
    })
    .from(follows)
    .where(eq(follows.followerUri, viewerUri))
    .all();
  const subscribedUris = subscribed
    .filter((r) => r.accepted)
    .map((r) => r.followedUri);

  const feed =
    subscribedUris.length === 0
      ? []
      : db
          .select()
          .from(threads)
          .where(inArray(threads.communityUri, subscribedUris))
          .orderBy(desc(threads.createdAt))
          .limit(30)
          .all();

  return (
    <>
      <h1>Your feed</h1>
      {subscribed.length > 0 && (
        <section>
          <h3>Subscriptions</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {subscribed.map((row) => (
              <li
                key={row.followedUri}
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "center",
                  marginBottom: "0.25rem",
                }}
              >
                <code>{row.followedUri}</code>
                <span className="muted">
                  {row.accepted ? "" : "(pending) "}
                </span>
                <form action={unfollowCommunity}>
                  <input
                    type="hidden"
                    name="followedUri"
                    value={row.followedUri}
                  />
                  <button
                    type="submit"
                    className="link-button"
                    style={{ margin: 0 }}
                  >
                    Unfollow
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
      {subscribedUris.length === 0 ? (
        <p className="muted">
          You don't subscribe to any communities yet.{" "}
          <Link href="/follow">Follow one</Link> to fill this page.
        </p>
      ) : feed.length === 0 ? (
        <p className="muted">
          You're subscribed to {subscribedUris.length}{" "}
          {subscribedUris.length === 1 ? "community" : "communities"}, but they
          haven't posted anything yet.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {feed.map((t) => (
            <FeedItem key={t.id} thread={t} />
          ))}
        </ul>
      )}
    </>
  );
}

function FeedItem({
  thread,
}: {
  thread: {
    id: number;
    uri: string;
    title: string;
    authorUri: string;
    communityUri: string;
    createdAt: Date;
  };
}) {
  const slug = extractSlug(thread.communityUri);
  return (
    <li className="card">
      <h3 style={{ margin: 0 }}>
        {slug ? (
          <Link href={`/users/${slug}/threads/${thread.id}`}>
            {thread.title}
          </Link>
        ) : (
          <a href={thread.uri}>{thread.title}</a>
        )}
      </h3>
      <p className="muted" style={{ margin: "0.25rem 0 0" }}>
        in <code>{thread.communityUri}</code> · by{" "}
        <code>{thread.authorUri}</code> ·{" "}
        {thread.createdAt.toLocaleString("en-US")}
      </p>
    </li>
  );
}

function extractSlug(communityUri: string): string | null {
  const m = communityUri.match(/\/users\/([^/]+)\/?$/);
  return m?.[1] ?? null;
}
