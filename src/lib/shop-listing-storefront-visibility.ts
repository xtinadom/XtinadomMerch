import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

/**
 * Listings eligible for the public creator storefront and cart resolution (`/s/...`).
 * Creators who remove a listing set `creatorRemovedFromShopAt` and `active: false`.
 */
export const storefrontShopListingWhere = {
  active: true,
  creatorRemovedFromShopAt: null,
  /** Admin “frozen” listings must not sell or appear publicly. */
  adminRemovedFromShopAt: null,
  /** Account-deletion pipeline hides storefront rows before full cleanup. */
  hiddenStorefrontForAccountDeletionAt: null,
} as const;

/**
 * Live listings on **creator** shops only — used for marketplace-wide `/shop/all`, `/shop/tag/…`,
 * and related aggregates. The seeded `platform` shop row is not a storefront catalog.
 */
export const marketplaceAggregatedListingWhere = {
  ...storefrontShopListingWhere,
  shop: {
    slug: { not: PLATFORM_SHOP_SLUG },
    active: true,
  },
} as const;
