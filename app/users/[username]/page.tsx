import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { communities, db, threads, users } from "@/db";
import { currentOrigin } from "@/lib/origin";
import { getCurrentUser } from "@/lib/session";

type ProfilePageProps = {
  params: Promise<{ username: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username: identifier } = await params;

  const user = db
    .select({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, identifier))
    .get();
  if (user) {
    return (
      <>
        <h1>@{user.username}</h1>
        <p className="muted">
          Joined{" "}
          {user.createdAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <p>Threads and replies by this user will appear here.</p>
      </>
    );
  }

  const community = db
    .select()
    .from(communities)
    .where(eq(communities.slug, identifier))
    .get();
  if (community) {
    const currentUser = await getCurrentUser();
    const origin = await currentOrigin();
    const communityUri = new URL(`/users/${identifier}`, origin).href;
    const threadRows = db
      .select({
        id: threads.id,
        uri: threads.uri,
        title: threads.title,
        authorUri: threads.authorUri,
        createdAt: threads.createdAt,
      })
      .from(threads)
      .where(eq(threads.communityUri, communityUri))
      .orderBy(desc(threads.createdAt))
      .all();

    return (
      <>
        <h1>!{community.slug}</h1>
        <h2 style={{ fontWeight: "normal", marginTop: 0 }}>{community.name}</h2>
        {community.description && <p>{community.description}</p>}
        <p className="muted">
          Created{" "}
          {community.createdAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        {currentUser && (
          <p>
            <Link
              href={`/users/${community.slug}/new-thread`}
              className="button"
            >
              Start a thread
            </Link>
          </p>
        )}
        <h3>Threads</h3>
        {threadRows.length === 0 ? (
          <p className="muted">No threads yet. Be the first.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {threadRows.map((t) => (
              <li key={t.id} className="card">
                <h4 style={{ margin: 0 }}>{t.title}</h4>
                <p className="muted">
                  Posted {t.createdAt.toLocaleDateString("en-US")} by{" "}
                  <code>{t.authorUri}</code>
                </p>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  notFound();
}
