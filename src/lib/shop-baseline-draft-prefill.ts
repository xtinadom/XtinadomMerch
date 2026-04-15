import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";
import { parseListingPrintifyVariantPrices } from "@/lib/listing-printify-variant-prices";
import {
  encodeBaselinePickAllVariants,
  encodeBaselinePickItem,
  encodeBaselinePickVariant,
  type AdminBaselineRow,
} from "@/lib/shop-baseline-catalog";
import {
  BASELINE_ALL_VARIANTS_STUB_KEY,
  computeBaselineStubSlug,
} from "@/lib/shop-baseline-stub-slug";

export type DraftListingRequestPrefillPayload = {
  listingId: string;
  catalogProductPick: string;
  listingPriceDollars: string | null;
  variantPricesJson: Record<string, string> | null;
  requestItemName: string;
};

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
  listingPrintifyVariantPrices?: unknown,
): Omit<DraftListingRequestPrefillPayload, "listingId"> | null {
  const name = (requestItemName ?? "").trim();
  const dollars = (Math.max(0, priceCents) / 100).toFixed(2);

  for (const item of items) {
    const variants = parseAdminCatalogVariantsJson(item.variants);
    if (variants.length === 0) {
      if (computeBaselineStubSlug(shopId, item.id, "item") === productSlug) {
        return {
          catalogProductPick: encodeBaselinePickItem(item.id),
          listingPriceDollars: dollars,
          variantPricesJson: null,
          requestItemName: name,
        };
      }
    } else {
      if (computeBaselineStubSlug(shopId, item.id, BASELINE_ALL_VARIANTS_STUB_KEY) === productSlug) {
        const map = parseListingPrintifyVariantPrices(listingPrintifyVariantPrices);
        const variantPricesJson: Record<string, string> = {};
        for (const v of variants) {
          const cents = map?.[v.id];
          if (cents != null) {
            variantPricesJson[encodeBaselinePickVariant(item.id, v.id)] = (cents / 100).toFixed(2);
          }
        }
        if (Object.keys(variantPricesJson).length === 0) {
          for (const v of variants) {
            variantPricesJson[encodeBaselinePickVariant(item.id, v.id)] = dollars;
          }
        }
        return {
          catalogProductPick: encodeBaselinePickAllVariants(item.id),
          listingPriceDollars: null,
          variantPricesJson,
          requestItemName: name,
        };
      }
      for (const v of variants) {
        if (computeBaselineStubSlug(shopId, item.id, `var:${v.id}`) === productSlug) {
          return {
            catalogProductPick: encodeBaselinePickAllVariants(item.id),
            listingPriceDollars: null,
            variantPricesJson: {
              [encodeBaselinePickVariant(item.id, v.id)]: dollars,
            },
            requestItemName: name,
          };
        }
      }
    }
  }
  return null;
}
