import { unstable_cache } from "next/cache";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  marketplaceAggregatedListingWhere,
  storefrontShopListingWhere,
} from "@/lib/shop-listing-storefront-visibility";

const liveListingProductWhere = {
  active: true,
} as const;

const STORE_TAGS_REVALIDATE_SECONDS = 120;

/**
 * Tags used on at least one storefront-visible listing (`/s/...` / platform catalog),
 * with an active product — same visibility as shop “All products” / tag pages.
 *
 * Cached across requests (see `unstable_cache`) so every navigation does not re-run the heavy
 * join query; still deduped per request via React `cache()`.
 */
const getStoreTagsFromDb = unstable_cache(
  async () => {
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
  },
  ["store-tags-platform-v1"],
  { revalidate: STORE_TAGS_REVALIDATE_SECONDS, tags: ["store-tags"] },
);

export const getStoreTags = cache(async () => getStoreTagsFromDb());

/** Tags that appear on at least one live listing in this creator shop. */
export const getStoreTagsForShop = cache(async (shopId: string) => {
  const run = unstable_cache(
    async () => {
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
    },
    ["store-tags-shop-v1", shopId],
    {
      revalidate: STORE_TAGS_REVALIDATE_SECONDS,
      tags: ["store-tags", `store-tags-shop-${shopId}`],
    },
  );
  return run();
});
