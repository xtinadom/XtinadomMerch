import { prisma } from "@/lib/prisma";
import type { CartLine } from "@/lib/session";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";

/**
 * Cart keys are `ShopListing.id`. Legacy sessions used `Product.id`; map those to platform listings.
 */
export async function hydrateCartListingKeys(
  items: Record<string, CartLine>,
): Promise<Record<string, CartLine>> {
  const out: Record<string, CartLine> = {};
  for (const [k, line] of Object.entries(items)) {
    if (!line || (line.quantity ?? 0) <= 0) continue;
    if (k.startsWith("sl_")) {
      out[k] = line;
      continue;
    }
    const listing = await prisma.shopListing.findFirst({
      where: {
        productId: k,
        shop: { slug: PLATFORM_SHOP_SLUG },
        ...storefrontShopListingWhere,
      },
      select: { id: true },
    });
    if (listing) out[listing.id] = line;
  }
  return out;
}

export async function inferShopIdFromListingIds(
  listingIds: string[],
): Promise<string | null> {
  if (listingIds.length === 0) return null;
  const first = listingIds[0]!;
  const row = await prisma.shopListing.findUnique({
    where: { id: first },
    select: { shopId: true },
  });
  return row?.shopId ?? null;
}
