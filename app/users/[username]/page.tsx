import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { communities, db, users } from "@/db";

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
        <p>Threads posted in this community will appear here.</p>
      </>
    );
  }

  notFound();
}
