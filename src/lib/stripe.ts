import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/** Server-side secret present (trimmed). Use before calling Stripe APIs from RSC so pages don’t hang on networking. */
export function isStripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!isStripeSecretConfigured()) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-03-25.dahlia",
      typescript: true,
      /** Default SDK timeout is ~80s — too long for dashboard RSC if Stripe/API is unreachable. */
      timeout: 20_000,
      maxNetworkRetries: 1,
    });
  }
  return stripeInstance;
}
