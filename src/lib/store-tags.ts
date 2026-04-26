import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  marketplaceAggregatedListingWhere,
  storefrontShopListingWhere,
} from "@/lib/shop-listing-storefront-visibility";

const liveListingProductWhere = {
  active: true,
} as const;

/**
 * Tags used on at least one storefront-visible listing (`/s/...` / platform catalog),
 * with an active product — same visibility as shop “All products” / tag pages.
 */
export const getStoreTags = cache(async () => {
  try {
    return await prisma.tag.findMany({
      where: {
        OR: [
          {
            productTags: {
              some: {
                product: {
                  ...liveListingProductWhere,
                  shopListings: {
                    some: { ...marketplaceAggregatedListingWhere },
                  },
                },
              },
            },
          },
          {
            primaryProducts: {
              some: {
                ...liveListingProductWhere,
                shopListings: {
                  some: { ...marketplaceAggregatedListingWhere },
                },
              },
            },
          },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  } catch (e) {
    console.error("[getStoreTags]", e);
    return [];
  }
});

/** Tags that appear on at least one live listing in this creator shop. */
export const getStoreTagsForShop = cache(async (shopId: string) => {
  try {
    return await prisma.tag.findMany({
      where: {
        OR: [
          {
            productTags: {
              some: {
                product: {
                  ...liveListingProductWhere,
                  shopListings: { some: { shopId, ...storefrontShopListingWhere } },
                },
              },
            },
          },
          {
            primaryProducts: {
              some: {
                ...liveListingProductWhere,
                shopListings: { some: { shopId, ...storefrontShopListingWhere } },
              },
            },
          },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  } catch (e) {
    console.error("[getStoreTagsForShop]", e);
    return [];
  }
});
