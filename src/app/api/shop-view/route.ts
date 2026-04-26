import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

const SLUG_RE = /^[\w-]{1,120}$/i;

/** POST `{ "shopSlug": "..." }` — increments `Shop.storefrontViewCount` for active creator shops. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const slug = String((body as { shopSlug?: unknown }).shopSlug ?? "").trim();
  if (!slug || !SLUG_RE.test(slug) || slug === PLATFORM_SHOP_SLUG) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const res = await prisma.shop.updateMany({
      where: { slug, active: true },
      data: { storefrontViewCount: { increment: 1 } },
    });
    return NextResponse.json({ ok: res.count > 0 });
  } catch (e) {
    console.error("[api/shop-view]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
