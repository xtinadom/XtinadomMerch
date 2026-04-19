/** Print on demand — no storefront stock cap (checkout still uses Stripe). */
export const CART_MAX_PRINTIFY_LINE_QTY = 9999;

/** Session read: allow large POD quantities. */
export const CART_SESSION_QUANTITY_CEILING = CART_MAX_PRINTIFY_LINE_QTY;

export function maxCartLineQty(_fulfillmentType: string | undefined | null): number {
  return CART_MAX_PRINTIFY_LINE_QTY;
}
