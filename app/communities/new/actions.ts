"use server";

import { redirect } from "next/navigation";
import { communities, db } from "@/db";
import { isIdentifierTaken, isValidIdentifier } from "@/lib/identifiers";
import { getCurrentUser } from "@/lib/session";

export async function createCommunity(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?message=Log+in+to+create+a+community");

  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!isValidIdentifier(slug)) {
    redirect("/communities/new?error=Invalid+slug");
  }
  if (!name) {
    redirect("/communities/new?error=Name+is+required");
  }
  if (isIdentifierTaken(slug)) {
    redirect(
      `/communities/new?error=${encodeURIComponent(
        "Slug is already taken by a user or another community",
      )}`,
    );
  }

  db.insert(communities)
    .values({ slug, name, description, creatorId: user.id })
    .run();

  redirect(`/users/${slug}`);
}
