/**
 * Listings eligible for the public creator storefront and cart resolution (`/s/...`).
 * Creators who remove a listing set `creatorRemovedFromShopAt` and `active: false`.
 */
export const storefrontShopListingWhere = {
  active: true,
  creatorRemovedFromShopAt: null,
} as const;
