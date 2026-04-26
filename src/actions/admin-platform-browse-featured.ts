"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";
import { PLATFORM_ALL_PAGE_FEATURED_LIMIT } from "@/lib/platform-all-page-featured-constants";
import type { Prisma } from "@/generated/prisma/client";
import { parseBrowseAllPageFeaturedProductIds } from "@/lib/browse-all-page-featured-product-ids";
import type { AdminSavePlatformBrowseFeaturedState } from "@/actions/admin-platform-browse-featured-state";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function adminSavePlatformBrowseFeaturedProductIdsForm(
  _prev: AdminSavePlatformBrowseFeaturedState,
  formData: FormData,
): Promise<AdminSavePlatformBrowseFeaturedState> {
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
  const normalized = parseBrowseAllPageFeaturedProductIds(parsed as Prisma.JsonValue);

  const platform = await prisma.shop.findUnique({
    where: { slug: PLATFORM_SHOP_SLUG },
    select: { id: true },
  });
  if (!platform) {
    return { ok: false, error: "Platform catalog shop is missing." };
  }
  if (normalized.length > PLATFORM_ALL_PAGE_FEATURED_LIMIT) {
    return { ok: false, error: `At most ${PLATFORM_ALL_PAGE_FEATURED_LIMIT} products.` };
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
      data: { browseAllPageFeaturedProductIds: normalized },
    });
  } catch (e) {
    console.error("[adminSavePlatformBrowseFeaturedProductIdsForm]", e);
    return { ok: false, error: "Could not save. Try again." };
  }

  revalidatePath("/shop/all");
  revalidatePath("/shop");
  return { ok: true, error: null };
}
