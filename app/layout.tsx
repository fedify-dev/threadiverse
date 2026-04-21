import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "./login/actions";
import "./globals.css";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Threadiverse",
  description: "A small federated community platform built with Fedify.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <nav className="site-nav">
          <div className="inner">
            <Link href="/" className="brand">
              Threadiverse
            </Link>
            <ul>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/communities/new">New community</Link>
              </li>
            </ul>
            {user ? (
              <form action={logout} className="session-controls">
                <span className="muted">@{user.username}</span>
                <button type="submit" className="link-button">
                  Log out
                </button>
              </form>
            ) : (
              <div className="session-controls">
                <Link href="/login">Log in</Link>
                <Link href="/signup">Sign up</Link>
              </div>
            )}
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
