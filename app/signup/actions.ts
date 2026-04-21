"use server";

import { redirect } from "next/navigation";
import { db, users } from "@/db";
import { hashPassword } from "@/lib/auth";
import { isIdentifierTaken, isValidIdentifier } from "@/lib/identifiers";

export async function signup(formData: FormData): Promise<void> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!isValidIdentifier(username)) {
    redirect("/signup?error=Invalid+username");
  }
  if (password.length < 8) {
    redirect("/signup?error=Password+must+be+at+least+8+characters");
  }
  if (isIdentifierTaken(username)) {
    redirect("/signup?error=Username+already+taken");
  }

  const passwordHash = await hashPassword(password);
  db.insert(users).values({ username, passwordHash }).run();

  redirect("/login?message=Account+created,+please+log+in");
}
