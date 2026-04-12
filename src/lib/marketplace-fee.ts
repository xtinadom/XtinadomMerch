/**
 * Split merchandise revenue (single line total in cents) between platform fee and shop remainder.
 * Values are persisted on `OrderLine` at checkout.
 */
export function splitLineRevenueMerchandiseCents(lineMerchandiseCents: number): {
  platformCutCents: number;
  shopCutCents: number;
} {
  const raw = process.env.MARKETPLACE_PLATFORM_FEE_PERCENT;
  const pct = raw ? parseInt(raw, 10) : 10;
  const rate = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 10)) / 100;
  const platformCutCents = Math.floor(lineMerchandiseCents * rate);
  const shopCutCents = lineMerchandiseCents - platformCutCents;
  return { platformCutCents, shopCutCents };
}
