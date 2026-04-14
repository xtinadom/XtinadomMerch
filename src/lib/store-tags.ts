import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";

/** One Prisma round-trip per request (layout + shop pages share this). */
export const getStoreTags = cache(async () => {
  try {
    return await prisma.tag.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  } catch (e) {
    console.error("[getStoreTags]", e);
    return [];
  }
});

/** Tags that appear on at least one active listing in the shop. */
export const getStoreTagsForShop = cache(async (shopId: string) => {
  try {
    return await prisma.tag.findMany({
      where: {
        productTags: {
          some: {
            product: {
              shopListings: { some: { shopId, ...storefrontShopListingWhere } },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  } catch (e) {
    console.error("[getStoreTagsForShop]", e);
    return [];
  }
});
