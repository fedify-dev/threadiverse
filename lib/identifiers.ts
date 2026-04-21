import "server-only";

import { eq } from "drizzle-orm";
import { communities, db, users } from "@/db";

export const IDENTIFIER_PATTERN = /^[a-zA-Z0-9_]{2,32}$/;

export function isValidIdentifier(identifier: string): boolean {
  return IDENTIFIER_PATTERN.test(identifier);
}

export function isIdentifierTaken(identifier: string): boolean {
  const user = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, identifier))
    .get();
  if (user) return true;
  const community = db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, identifier))
    .get();
  return community != null;
}
