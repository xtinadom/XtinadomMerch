/** Decimal, e.g. 0.06625 for 6.625%. Omit — tax line shows “at checkout” only. */
export function parseEstimatedSalesTaxRate(): number | null {
  const raw = process.env.ESTIMATED_SALES_TAX_RATE?.trim();
  if (!raw) return null;
  const r = Number(raw);
  if (!Number.isFinite(r) || r < 0 || r > 0.5) return null;
  return r;
}

export function estimatedTaxCents(
  taxableCents: number,
  rate: number | null,
): number | null {
  if (rate == null || taxableCents <= 0) return rate == null ? null : 0;
  return Math.round(taxableCents * rate);
}
