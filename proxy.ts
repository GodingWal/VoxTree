import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth/config";
import { featureForPath, isFeatureEnabled } from "@/lib/features";

// Auth.js session check (JWT — no DB in the proxy path). Replaces the
// former hosted-auth `updateSession` refresh/guard.
const { auth } = NextAuth(authConfig);

export const proxy = auth((request) => {
  const feature = featureForPath(request.nextUrl.pathname);
  if (feature && !isFeatureEnabled(feature)) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Feature is not enabled" }, { status: 404 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users away from protected routes
  // (same behavior as the former auth middleware).
  if (!request.auth && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
