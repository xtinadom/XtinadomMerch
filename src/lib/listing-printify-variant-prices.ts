/** Parse `ShopListing.listingPrintifyVariantPrices` JSON: `{ [printifyVariantId]: cents }`. */
export function parseListingPrintifyVariantPrices(value: unknown): Record<string, number> | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const id = k.trim();
    if (!id) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const c = Math.round(v);
    if (c < 0) continue;
    out[id] = c;
  }
  return Object.keys(out).length > 0 ? out : null;
}
