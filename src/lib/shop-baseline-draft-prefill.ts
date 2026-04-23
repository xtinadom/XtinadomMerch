import { encodeBaselinePickItem, parseBaselinePick, type AdminBaselineRow } from "@/lib/shop-baseline-catalog";
import { computeBaselineStubSlug } from "@/lib/shop-baseline-stub-slug";

export type DraftListingRequestPrefillPayload = {
  listingId: string;
  catalogProductPick: string;
  listingPriceDollars: string | null;
  variantPricesJson: Record<string, string> | null;
  requestItemName: string;
};

/**
 * Restores Request listing form state from {@link ShopListing.baselineCatalogPickEncoded} (saved at submit).
 * Used when stub `Product.slug` is unique per listing row instead of the legacy deterministic `bl-…` slug.
 *
 * Legacy `allVariants` / per-variant picks are collapsed to a single item pick with one list price.
 */
export function resolveCatalogPrefillFromBaselinePickEncoded(
  encodedPick: string,
  priceCents: number,
  requestItemName: string | null,
  items: AdminBaselineRow[],
): Omit<DraftListingRequestPrefillPayload, "listingId"> | null {
  const parsed = parseBaselinePick(encodedPick);
  if (!parsed) return null;
  const name = (requestItemName ?? "").trim();
  const dollars = (Math.max(0, priceCents) / 100).toFixed(2);

  const row = items.find((i) => i.id === parsed.itemId);
  if (!row) return null;

  return {
    catalogProductPick: encodeBaselinePickItem(row.id),
    listingPriceDollars: dollars,
    variantPricesJson: null,
    requestItemName: name,
  };
}

/**
 * Maps a draft listing’s stub product slug back to Request listing form state (catalog pick + prices).
 * Returns null if the product is not a baseline stub for this shop/catalog.
 */
export function resolveCatalogPrefillFromStubProductSlug(
  shopId: string,
  productSlug: string,
  priceCents: number,
  requestItemName: string | null,
  items: AdminBaselineRow[],
): Omit<DraftListingRequestPrefillPayload, "listingId"> | null {
  const name = (requestItemName ?? "").trim();
  const dollars = (Math.max(0, priceCents) / 100).toFixed(2);

  for (const item of items) {
    if (computeBaselineStubSlug(shopId, item.id, "item") === productSlug) {
      return {
        catalogProductPick: encodeBaselinePickItem(item.id),
        listingPriceDollars: dollars,
        variantPricesJson: null,
        requestItemName: name,
      };
    }
  }
  return null;
}
