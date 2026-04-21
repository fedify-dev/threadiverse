import { integrateFederation, isFederationRequest } from "@fedify/next";
import { NextResponse } from "next/server";
import { getXForwardedRequest } from "x-forwarded-fetch";
import federation from "./federation";
import "./logging";

const federationHandler = integrateFederation(federation);

export default async function middleware(request: Request) {
  const forwarded = await getXForwardedRequest(request);
  if (isFederationRequest(forwarded)) {
    return await federationHandler(forwarded);
  }
  return NextResponse.next();
}

// This config needs because middleware process only requests with the
// "Accept" header matching the federation accept regex.
// More details: https://nextjs.org/docs/app/api-reference/file-conventions/middleware#config-object-optional
export const config = {
  runtime: "nodejs",
  matcher: [
    {
      source: "/:path*",
      has: [
        {
          type: "header",
          key: "Accept",
          value: ".*application\\/((jrd|activity|ld)\\+json|xrd\\+xml).*",
        },
      ],
    },
    {
      source: "/:path*",
      has: [
        {
          type: "header",
          key: "content-type",
          value: ".*application\\/((jrd|activity|ld)\\+json|xrd\\+xml).*",
        },
      ],
    },
    { source: "/.well-known/nodeinfo" },
    { source: "/.well-known/x-nodeinfo2" },
  ],
};
