// src/middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.get("has_session")?.value;
  const { pathname } = request.nextUrl;

  // If trying to access dashboard without a session, redirect to login
  if (pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If already logged in and on login page, redirect to dashboard
  if (pathname === "/" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard/users", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};