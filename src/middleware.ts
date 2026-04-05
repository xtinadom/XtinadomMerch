import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SITE_GATE_COOKIE } from "@/lib/site-gate";

function redirectToCanonicalHost(request: NextRequest): NextResponse | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw || process.env.NODE_ENV !== "production") {
    return null;
  }
  try {
    const canonical = new URL(raw);
    const host = request.nextUrl.hostname.toLowerCase();
    const canonicalHost = canonical.hostname.toLowerCase();
    if (host === canonicalHost) {
      return null;
    }
    const apex = (h: string) => h.replace(/^www\./, "");
    if (apex(host) !== apex(canonicalHost)) {
      return null;
    }
    const url = request.nextUrl.clone();
    url.hostname = canonicalHost;
    url.protocol = canonical.protocol === "http:" ? "https:" : canonical.protocol;
    url.port = "";
    return NextResponse.redirect(url, 308);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const canonicalRedirect = redirectToCanonicalHost(request);
  if (canonicalRedirect) {
    return canonicalRedirect;
  }

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
