import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { createCommunity } from "./actions";

type NewCommunityPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewCommunityPage({
  searchParams,
}: NewCommunityPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?message=Log+in+to+create+a+community");
  const { error } = await searchParams;
  return (
    <>
      <h1>Create a community</h1>
      <p className="muted">
        You are opening this community as <strong>@{user.username}</strong>.
      </p>
      {error && <p className="muted">{error}</p>}
      <form action={createCommunity}>
        <label>
          Slug
          <input
            type="text"
            name="slug"
            required
            pattern="[a-zA-Z0-9_]{2,32}"
            title="2–32 letters, digits, or underscores"
          />
        </label>
        <label>
          Name
          <input type="text" name="name" required maxLength={64} />
        </label>
        <label>
          Description
          <textarea name="description" maxLength={500} />
        </label>
        <button type="submit">Create community</button>
      </form>
      <p className="muted">
        The slug becomes the community's federated handle, e.g.{" "}
        <code>!slug@your-host</code>.
      </p>
    </>
  );
}
