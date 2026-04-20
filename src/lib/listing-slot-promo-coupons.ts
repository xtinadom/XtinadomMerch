export type ListingSlotPromoRule = {
  slots: number;
  /** When set, cap total redemptions of this code across all shops. */
  maxRedemptions?: number;
};

function parsePositiveInt(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i > 0 ? i : null;
}

function parseRule(value: unknown): ListingSlotPromoRule | null {
  if (typeof value === "number") {
    const slots = parsePositiveInt(value);
    return slots != null ? { slots } : null;
  }
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const slots = parsePositiveInt(o.slots);
  if (slots == null) return null;
  const maxRaw = o.maxRedemptions;
  let maxRedemptions: number | undefined;
  if (maxRaw !== undefined && maxRaw !== null) {
    const m = parsePositiveInt(maxRaw);
    if (m != null) maxRedemptions = m;
  }
  return { slots, maxRedemptions };
}

/**
 * `LISTING_SLOT_PROMO_COUPONS_JSON` — object keyed by coupon string (matched case-insensitively).
 * Values: a positive integer (slot count) or `{ "slots": N, "maxRedemptions"?: M }`.
 *
 * @example
 * {"LAUNCH2026": 2, "PARTNER": {"slots": 5, "maxRedemptions": 20}}
 */
export function parseListingSlotPromoCouponsFromEnv(): Map<string, ListingSlotPromoRule> {
  const raw = process.env.LISTING_SLOT_PROMO_COUPONS_JSON?.trim();
  const out = new Map<string, ListingSlotPromoRule>();
  if (!raw) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const key = k.trim().toUpperCase();
    if (!key) continue;
    const rule = parseRule(v);
    if (rule) out.set(key, rule);
  }
  return out;
}

export function normalizeListingSlotPromoCodeInput(raw: string): string {
  return raw.trim().toUpperCase();
}

export function lookupListingSlotPromoRule(
  coupons: Map<string, ListingSlotPromoRule>,
  normalizedCode: string,
): ListingSlotPromoRule | null {
  if (!normalizedCode) return null;
  return coupons.get(normalizedCode) ?? null;
}
