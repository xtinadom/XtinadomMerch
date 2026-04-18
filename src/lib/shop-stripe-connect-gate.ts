/**
 * Whether the shop can be charged a listing publication fee via Stripe (Connect must be usable).
 */
export function shopStripeConnectReadyForListingCharges(shop: {
  stripeConnectAccountId: string | null;
  connectChargesEnabled: boolean;
  payoutsEnabled: boolean;
}): boolean {
  return (
    Boolean(shop.stripeConnectAccountId?.trim()) &&
    shop.connectChargesEnabled === true &&
    shop.payoutsEnabled === true
  );
}
