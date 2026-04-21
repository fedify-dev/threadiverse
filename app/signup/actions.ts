"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import { hashPassword } from "@/lib/auth";

export async function signup(formData: FormData): Promise<void> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!/^[a-zA-Z0-9_]{2,32}$/.test(username)) {
    redirect("/signup?error=Invalid+username");
  }
  if (password.length < 8) {
    redirect("/signup?error=Password+must+be+at+least+8+characters");
  }

  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (existing) {
    redirect("/signup?error=Username+already+taken");
  }

  const passwordHash = await hashPassword(password);
  db.insert(users).values({ username, passwordHash }).run();

  redirect("/login?message=Account+created,+please+log+in");
}
