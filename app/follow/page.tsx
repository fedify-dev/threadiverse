import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { followCommunity } from "./actions";

type FollowPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function FollowPage({ searchParams }: FollowPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?message=Log+in+to+follow+a+community");
  const { error, message } = await searchParams;
  return (
    <>
      <h1>Follow a community</h1>
      <p className="muted">
        Paste a community handle in the form <code>@slug@host</code> (for
        example <code>@fediverse@lemmy.ml</code>) or a direct URL to a community
        on any threadiverse-compatible server.
      </p>
      {message && <p className="muted">{message}</p>}
      {error && <p className="muted">{error}</p>}
      <form action={followCommunity}>
        <label>
          Handle or URL
          <input type="text" name="handle" required />
        </label>
        <button type="submit">Send follow request</button>
      </form>
    </>
  );
}
