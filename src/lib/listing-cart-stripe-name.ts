import type { Product } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import type { CartLine } from "@/lib/session";
import { resolvePrintifyCheckoutLine } from "@/lib/printify-variants";

type P = Pick<
  Product,
  "name" | "fulfillmentType" | "priceCents" | "printifyVariantId" | "printifyVariants"
>;

export function listingStripeProductName(
  listing: { priceCents: number; product: P },
  cartLine: CartLine | undefined,
): { name: string; printifyVariantId: string | null } {
  const p = listing.product;
  if (p.fulfillmentType !== FulfillmentType.printify) {
    return { name: p.name, printifyVariantId: null };
  }
  const r = resolvePrintifyCheckoutLine(p, cartLine);
  if (!r) return { name: p.name, printifyVariantId: p.printifyVariantId };
  return { name: r.stripeName, printifyVariantId: r.printifyVariantId };
}
