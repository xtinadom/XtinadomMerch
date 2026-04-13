/** Canonical slug for the legacy / single-catalog shop (migration seed). */
export const PLATFORM_SHOP_SLUG = "platform" as const;

/** First N listings per shop have no publication fee (ordered by creation time). */
export const LISTING_FEE_FREE_SLOT_COUNT = 3;

/**
 * Listing publication fee (USD cents) for each listing after the free slots.
 * First {@link LISTING_FEE_FREE_SLOT_COUNT} listings are free.
 */
export const LISTING_FEE_CENTS = 25;

/** Fee in cents for the Nth listing in a shop (1 = oldest), after free slots. */
export function listingFeeCentsForOrdinal(ordinal1Based: number): number {
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

export function shopSubHref(shopSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return "/shop/sub";
  return `/s/${shopSlug}/sub`;
}

export function shopDommeHref(shopSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return "/shop/domme";
  return `/s/${shopSlug}/domme`;
}

export function shopUniversalTagHref(shopSlug: string, tagSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return `/shop/tag/${tagSlug}`;
  return `/s/${shopSlug}/tag/${tagSlug}`;
}

export function shopCollectionTagHref(
  shopSlug: string,
  collection: "sub" | "domme",
  tagSlug: string,
): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) {
    return `/shop/${collection}/tag/${tagSlug}`;
  }
  return `/s/${shopSlug}/${collection}/tag/${tagSlug}`;
}
