import type { Product } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import type { CartLine } from "@/lib/session";
import {
  getPrintifyVariantsForProduct,
  resolvePrintifyCheckoutLine,
} from "@/lib/printify-variants";

type ListingWithProduct = {
  priceCents: number;
  listingPrintifyVariantId?: string | null;
  product: Pick<
    Product,
    | "fulfillmentType"
    | "priceCents"
    | "printifyVariantId"
    | "printifyVariants"
    | "name"
  >;
};

/** Unit price for cart/checkout: listing price for manual / single-variant; resolved Printify price when multi-variant. */
export function listingCartUnitCents(
  listing: ListingWithProduct,
  cartLine: CartLine | undefined,
): number {
  const p = listing.product;
  if (p.fulfillmentType !== FulfillmentType.printify) {
    return listing.priceCents;
  }
  if (listing.listingPrintifyVariantId?.trim()) {
    return listing.priceCents;
  }
  const variants = getPrintifyVariantsForProduct(p);
  if (variants.length <= 1) {
    return listing.priceCents;
  }
  const r = resolvePrintifyCheckoutLine(p, cartLine);
  return r?.unitPriceCents ?? listing.priceCents;
}
