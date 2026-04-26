import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Product slugs are kebab-case; allow alnum, underscore, hyphen. */
const SLUG_RE = /^[\w-]{1,220}$/i;

/**
 * POST `{ "productSlug": "..." }` — increments `Product.storefrontViewCount` for active products.
 * Best-effort (used for home carousel ranking); callers should not treat failures as user-facing errors.
 */
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
  const slug = String((body as { productSlug?: unknown }).productSlug ?? "").trim();
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const res = await prisma.product.updateMany({
      where: { slug, active: true },
      data: { storefrontViewCount: { increment: 1 } },
    });
    return NextResponse.json({ ok: res.count > 0 });
  } catch (e) {
    console.error("[api/product-view]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
