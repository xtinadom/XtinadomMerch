import { getStripe, isStripeSecretConfigured } from "@/lib/stripe";

/** Sum Stripe balance amounts for a currency (smallest currency unit, e.g. cents for USD). */
function sumForCurrency(
  entries: { amount: number; currency: string }[] | undefined,
  currency: string,
): number {
  if (!entries?.length) return 0;
  const c = currency.toLowerCase();
  return entries.filter((e) => e.currency?.toLowerCase() === c).reduce((s, e) => s + e.amount, 0);
}

/**
 * Returns available + pending balances on a **connected** Stripe Express account (USD only for display checks).
 * `null` when Stripe is not configured or the request fails.
 */
export async function getStripeConnectBalanceUsdCents(
  stripeConnectAccountId: string | null | undefined,
): Promise<{ availableCents: number; pendingCents: number } | null> {
  const id = stripeConnectAccountId?.trim();
  if (!id) return { availableCents: 0, pendingCents: 0 };
  if (!isStripeSecretConfigured()) return null;

  try {
    const stripe = getStripe();
    const b = await stripe.balance.retrieve({}, { stripeAccount: id });
    const availableCents = sumForCurrency(b.available as { amount: number; currency: string }[], "usd");
    const pendingCents = sumForCurrency(b.pending as { amount: number; currency: string }[], "usd");
    return { availableCents, pendingCents };
  } catch (e) {
    console.error("[stripe-connect-balance] retrieve failed", e);
    return null;
  }
}

export function connectBalanceBlocksDeletion(
  balance: { availableCents: number; pendingCents: number } | null,
): boolean {
  if (!balance) return true;
  return balance.availableCents !== 0 || balance.pendingCents !== 0;
}
