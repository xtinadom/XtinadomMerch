import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { confirmShopAccountDeletionFromRawToken } from "@/lib/shop-account-deletion";
import {
  applyVerifiedAccountDeletionListingAndMediaCleanup,
  purgeShopUploadedMediaFromR2,
} from "@/lib/shop-account-deletion-request-effects";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  const r = await confirmShopAccountDeletionFromRawToken(t);

  if (!r.ok) {
    const reason =
      r.reason === "expired"
        ? "expired"
        : r.reason === "missing"
          ? "missing"
          : "invalid";
    return NextResponse.redirect(
      new URL(`/dashboard?dash=setup&delConfirm=${reason}`, url.origin),
      302,
    );
  }

  try {
    await purgeShopUploadedMediaFromR2(r.shopId);
    await applyVerifiedAccountDeletionListingAndMediaCleanup(r.shopId);
  } catch (e) {
    console.error("[account-deletion/confirm] purge/cleanup after email verify", e);
    return NextResponse.redirect(
      new URL("/dashboard?dash=setup&delConfirm=purgeFailed", url.origin),
      302,
    );
  }

  const shop = await prisma.shop.findUnique({
    where: { id: r.shopId },
    select: { slug: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/shops");
  if (shop) {
    revalidatePath(`/s/${shop.slug}`);
  }
  return NextResponse.redirect(new URL("/dashboard?dash=setup&delConfirm=ok", url.origin), 302);
}
