import Link from "next/link";
import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;
  return (
    <>
      <h1>Log in</h1>
      {message && <p className="muted">{message}</p>}
      {error && <p className="muted">{error}</p>}
      <form action={login}>
        <label>
          Username
          <input type="text" name="username" required />
        </label>
        <label>
          Password
          <input type="password" name="password" required />
        </label>
        <button type="submit">Log in</button>
      </form>
      <p className="muted">
        Need an account? <Link href="/signup">Sign up</Link>.
      </p>
    </>
  );
}
