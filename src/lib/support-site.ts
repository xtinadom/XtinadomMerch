/** Default voluntary tip in USD cents (Stripe minimum is typically 50). */
const DEFAULT_SUPPORT_TIP_CENTS = 500;

/** Voluntary “support the site” Checkout amount (USD cents). Override with `SUPPORT_TIP_CENTS`. */
export function configuredSupportTipCents(): number {
  const raw = process.env.SUPPORT_TIP_CENTS?.trim();
  if (!raw) return DEFAULT_SUPPORT_TIP_CENTS;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 50) return DEFAULT_SUPPORT_TIP_CENTS;
  return Math.min(n, 99_999_900);
}

export function isSupportCheckoutConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
