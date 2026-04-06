import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { SITE_GATE_COOKIE, siteGateCookieDomain } from "@/lib/site-gate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const password = process.env.SITE_ACCESS_PASSWORD;
  const secret = process.env.SITE_ACCESS_SECRET;

  if (!password?.trim() || !secret?.trim()) {
    return Response.json(
      { error: "Site access is not configured (missing env vars)." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pwd =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof (body as { password: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  if (pwd !== password) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await new SignJWT({ site: "xtinadom" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(secret));

  const jar = await cookies();
  const domain = siteGateCookieDomain();
  jar.set(SITE_GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    ...(domain ? { domain } : {}),
  });

  return Response.json({ ok: true });
}
