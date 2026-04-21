import Link from "next/link";
import { signup } from "./actions";

type SignupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;
  return (
    <>
      <h1>Sign up</h1>
      {error && <p className="muted">{error}</p>}
      <form action={signup}>
        <label>
          Username
          <input
            type="text"
            name="username"
            required
            pattern="[a-zA-Z0-9_]{2,32}"
            title="2–32 letters, digits, or underscores"
          />
        </label>
        <label>
          Password
          <input type="password" name="password" required minLength={8} />
        </label>
        <button type="submit">Create account</button>
      </form>
      <p className="muted">
        Already have an account? <Link href="/login">Log in</Link>.
      </p>
    </>
  );
}
