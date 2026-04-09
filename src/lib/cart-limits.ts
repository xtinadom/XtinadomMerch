import { FulfillmentType } from "@/generated/prisma/enums";

/** Print on demand — no storefront stock cap (checkout still uses Stripe). */
export const CART_MAX_PRINTIFY_LINE_QTY = 9999;

/** Manual / other — reasonable cart line cap. */
export const CART_MAX_MANUAL_LINE_QTY = 99;

/** Session read: allow large POD quantities; manual still clamped in add/set with product lookup. */
export const CART_SESSION_QUANTITY_CEILING = CART_MAX_PRINTIFY_LINE_QTY;

export function maxCartLineQty(fulfillmentType: string | undefined | null): number {
  return fulfillmentType === FulfillmentType.printify
    ? CART_MAX_PRINTIFY_LINE_QTY
    : CART_MAX_MANUAL_LINE_QTY;
}
