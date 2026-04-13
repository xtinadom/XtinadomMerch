import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SITE_GATE_COOKIE, siteGateCookieDomain } from "@/lib/site-gate";
import { publicAppOrigin } from "@/lib/public-app-url";

/** Force HTTPS in production (fixes “Not secure” when users hit http:// or env used http). */
function redirectHttpToHttps(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }
  // Vercel already terminates TLS; repeating HTTP→HTTPS here can loop if an upstream proxy
  // (e.g. Cloudflare “Flexible” SSL) sets `x-forwarded-proto: http` while the browser URL is https.
  if (process.env.VERCEL === "1") {
    return null;
  }
  const host = request.nextUrl.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return null;
  }
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded === "http" || request.nextUrl.protocol === "http:") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }
  return null;
}

function redirectToCanonicalHost(request: NextRequest): NextResponse | null {
  const canonical = publicAppOrigin();
  if (!canonical || process.env.NODE_ENV !== "production") {
    return null;
  }
  try {
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
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const httpsRedirect = redirectHttpToHttps(request);
  if (httpsRedirect) {
    return httpsRedirect;
  }

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
    pathname.startsWith("/dashboard/login") ||
    pathname.startsWith("/dashboard/forgot-password") ||
    pathname.startsWith("/dashboard/preview-reset-email") ||
    pathname.startsWith("/dashboard/reset-password") ||
    pathname.startsWith("/api/site-access") ||
    pathname.startsWith("/api/health") ||
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
      /* Bad or expired token — clear it so /gate + login can recover cleanly. */
      const gate = new URL("/gate", request.url);
      if (pathname !== "/") {
        gate.searchParams.set("from", pathname + request.nextUrl.search);
      }
      const res = NextResponse.redirect(gate);
      const domain = siteGateCookieDomain();
      res.cookies.set(SITE_GATE_COOKIE, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        ...(domain ? { domain } : {}),
      });
      return res;
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
