import "server-only";

import { headers } from "next/headers";

export async function currentOrigin(): Promise<URL> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return new URL(`${proto}://${host}`);
}
