import type { Product } from "@/generated/prisma/client";
import type { CartLine } from "@/lib/session";
import { parseListingPrintifyVariantPrices } from "@/lib/listing-printify-variant-prices";
import {
  getPrintifyVariantsForProduct,
  resolvePrintifyCheckoutLine,
} from "@/lib/printify-variants";

type ListingWithProduct = {
  priceCents: number;
  listingPrintifyVariantId?: string | null;
  listingPrintifyVariantPrices?: unknown;
  product: Pick<
    Product,
    | "fulfillmentType"
    | "priceCents"
    | "printifyVariantId"
    | "printifyVariants"
    | "name"
  >;
};

/**
 * Minimum shop price (cents) for one Printify option: `Product.minPriceCents` when set (platform floor),
 * and never below that variant's synced retail from `printifyVariants` (not `Product.priceCents`, which
 * is only the default row and can be higher than a smaller size).
 */
export function printifyVariantShopFloorCents(
  product: Pick<Product, "minPriceCents" | "priceCents">,
  variantCatalogRetailCents: number,
): number {
  const adminFloor = product.minPriceCents > 0 ? product.minPriceCents : 0;
  return Math.max(adminFloor, variantCatalogRetailCents);
}

/** Dashboard "Catalog · min …" line: one number creators can compare to validation. */
export function dashboardListingMinPriceHintCents(
  product: Pick<
    Product,
    "fulfillmentType" | "minPriceCents" | "priceCents" | "printifyVariantId" | "printifyVariants"
  >,
): number {
  const vs = getPrintifyVariantsForProduct(product);
  if (vs.length === 0) {
    return product.minPriceCents > 0 ? product.minPriceCents : product.priceCents;
  }
  if (vs.length === 1) {
    return printifyVariantShopFloorCents(product, vs[0]!.priceCents);
  }
  return Math.min(...vs.map((v) => printifyVariantShopFloorCents(product, v.priceCents)));
}

/**
 * Per-variant shop prices for PDP / variant picker (same rules as {@link listingCartUnitCents} for each option).
 */
export function printifyVariantShopPriceCentsByIdForListing(
  listing: Pick<ListingWithProduct, "priceCents" | "listingPrintifyVariantPrices">,
  product: Pick<
    Product,
    "fulfillmentType" | "priceCents" | "printifyVariantId" | "printifyVariants"
  >,
): Record<string, number> | undefined {
  const variants = getPrintifyVariantsForProduct(product);
  if (variants.length <= 1) return undefined;
  const map = parseListingPrintifyVariantPrices(listing.listingPrintifyVariantPrices);
  const out: Record<string, number> = {};
  for (const v of variants) {
    out[v.id] = map?.[v.id] ?? listing.priceCents;
  }
  return out;
}

/** Unit price for cart/checkout: listing row price, optional per-Printify-variant map, or catalog variant price. */
export function listingCartUnitCents(
  listing: ListingWithProduct,
  cartLine: CartLine | undefined,
): number {
  const p = listing.product;
  const variants = getPrintifyVariantsForProduct(p);
  if (variants.length <= 1) {
    return listing.priceCents;
  }
  const r = resolvePrintifyCheckoutLine(p, cartLine);
  if (!r) return listing.priceCents;
  const map = parseListingPrintifyVariantPrices(listing.listingPrintifyVariantPrices);
  if (map && map[r.printifyVariantId] != null) {
    return map[r.printifyVariantId]!;
  }
  return listing.priceCents;
}
