"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";
import { HOME_HOT_CAROUSEL_LIMIT } from "@/lib/platform-all-page-featured-constants";
import type { Prisma } from "@/generated/prisma/client";
import { parseShopOrderedFeaturedProductIds } from "@/lib/shop-ordered-featured-product-ids";
import type { AdminSaveHomeHotCarouselFeaturedState } from "@/actions/admin-home-hot-carousel-featured-state";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function adminSaveHomeHotCarouselFeaturedProductIdsForm(
  _prev: AdminSaveHomeHotCarouselFeaturedState,
  formData: FormData,
): Promise<AdminSaveHomeHotCarouselFeaturedState> {
  await requireAdmin();
  const raw = formData.get("productIdsJson");
  let parsed: unknown = null;
  if (typeof raw === "string" && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Invalid JSON in form." };
    }
  }
  const normalized = parseShopOrderedFeaturedProductIds(parsed as Prisma.JsonValue);

  const platform = await prisma.shop.findUnique({
    where: { slug: PLATFORM_SHOP_SLUG },
    select: { id: true },
  });
  if (!platform) {
    return { ok: false, error: "Platform catalog shop is missing." };
  }
  if (normalized.length > HOME_HOT_CAROUSEL_LIMIT) {
    return { ok: false, error: `At most ${HOME_HOT_CAROUSEL_LIMIT} products.` };
  }

  if (normalized.length > 0) {
    const rows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        productId: { in: normalized },
        product: { active: true },
      },
      select: { productId: true },
    });
    const ok = new Set(rows.map((r) => r.productId));
    const missing = normalized.filter((id) => !ok.has(id));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Not all IDs are on a live creator listing: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
      };
    }
  }

  try {
    await prisma.shop.update({
      where: { id: platform.id },
      data: { homeHotCarouselFeaturedProductIds: normalized },
    });
  } catch (e) {
    console.error("[adminSaveHomeHotCarouselFeaturedProductIdsForm]", e);
    return { ok: false, error: "Could not save. Try again." };
  }

  revalidatePath("/");
  revalidatePath("/shop/all");
  return { ok: true, error: null };
}
