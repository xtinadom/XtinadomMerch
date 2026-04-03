import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SITE_GATE_COOKIE } from "@/lib/site-gate";

export async function middleware(request: NextRequest) {
  const password = process.env.SITE_ACCESS_PASSWORD;
  const secret = process.env.SITE_ACCESS_SECRET;

  if (!password?.trim() || !secret?.trim()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/gate") ||
    pathname.startsWith("/api/site-access") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SITE_GATE_COOKIE)?.value;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      return NextResponse.next();
    } catch {
      /* redirect to gate */
    }
  }

  const gate = new URL("/gate", request.url);
  if (pathname !== "/") {
    gate.searchParams.set("from", pathname + request.nextUrl.search);
  }
  return NextResponse.redirect(gate);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
