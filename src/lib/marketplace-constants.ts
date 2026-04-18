/** Canonical slug for the legacy / single-catalog shop (migration seed). */
export const PLATFORM_SHOP_SLUG = "platform" as const;

/**
 * Founder’s creator shop — unlimited free publication slots (same fee logic as infinitely many free ordinals).
 */
export const FOUNDER_UNLIMITED_FREE_LISTINGS_SHOP_SLUG = "goddess-xtina" as const;

export function isFounderUnlimitedFreeListingsShop(shopSlug: string): boolean {
  return shopSlug === FOUNDER_UNLIMITED_FREE_LISTINGS_SHOP_SLUG;
}

/** First N listings per shop have no publication fee (ordered by creation time). */
export const LISTING_FEE_FREE_SLOT_COUNT = 3;

/**
 * Shop listing ids that were published at no fee outside the normal first-N free slots
 * (comps, one-off promos). Admin Shop watch shows these with ":)" instead of "--".
 * Founder unlimited-free shop does not need ids listed here.
 */
export const SPECIAL_PROMOTION_FREE_LISTING_IDS = new Set<string>([]);

/**
 * Listing publication fee (USD cents) for each listing after the free slots.
 * First {@link LISTING_FEE_FREE_SLOT_COUNT} listings are free.
 */
export const LISTING_FEE_CENTS = 25;

/**
 * Maximum shop-owner list price (USD cents) for listing requests and dashboard price edits.
 * Enforced on submit / save; admin tooling is not limited by this constant.
 */
export const SHOP_LISTING_MAX_PRICE_CENTS = 50_000;

/** e.g. "$500.00" for UI copy tied to {@link SHOP_LISTING_MAX_PRICE_CENTS}. */
export function shopListingMaxPriceUsdLabel(): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(SHOP_LISTING_MAX_PRICE_CENTS / 100);
}

/** Fee in cents for the Nth listing in a shop (1 = oldest), after free slots. */
export function listingFeeCentsForOrdinal(ordinal1Based: number, shopSlug?: string): number {
  if (shopSlug && isFounderUnlimitedFreeListingsShop(shopSlug)) {
    return 0;
  }
  if (ordinal1Based <= 0) return LISTING_FEE_CENTS;
  return ordinal1Based <= LISTING_FEE_FREE_SLOT_COUNT ? 0 : LISTING_FEE_CENTS;
}

/** Listing id prefix used in SQL migration (`sl_` || productId). */
export const LISTING_ID_PREFIX = "sl_" as const;

export function listingIdForProductId(productId: string): string {
  return `${LISTING_ID_PREFIX}${productId}`;
}

export function productHref(shopSlug: string, productSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) {
    return `/product/${productSlug}`;
  }
  return `/s/${shopSlug}/product/${productSlug}`;
}

export function shopCartHref(shopSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return "/cart";
  return `/s/${shopSlug}/cart`;
}

export function shopCheckoutHref(shopSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return "/checkout";
  return `/s/${shopSlug}/checkout`;
}

export function shopAllProductsHref(shopSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return "/shop/all";
  return `/s/${shopSlug}/all`;
}

export function shopUniversalTagHref(shopSlug: string, tagSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return `/shop/tag/${tagSlug}`;
  return `/s/${shopSlug}/tag/${tagSlug}`;
}
