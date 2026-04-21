import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, users } from "@/db";

type ProfilePageProps = {
  params: Promise<{ username: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const user = db
    .select({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (!user) notFound();
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
