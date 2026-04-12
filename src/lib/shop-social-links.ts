export const SHOP_SOCIAL_KEYS = [
  "reddit",
  "x",
  "bluesky",
  "twitch",
  "loyalfans",
  "onlyfans",
  "instagram",
] as const;

export type ShopSocialKey = (typeof SHOP_SOCIAL_KEYS)[number];

export type ShopSocialLinksRecord = Partial<Record<ShopSocialKey, string>>;

function normalizeSocialUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return `https://${t}`;
}

/** Parse form keys `social_reddit`, … into a JSON-ready object (only non-empty). */
export function shopSocialLinksFromFormData(formData: FormData): ShopSocialLinksRecord {
  const out: ShopSocialLinksRecord = {};
  for (const key of SHOP_SOCIAL_KEYS) {
    const v = String(formData.get(`social_${key}`) ?? "").trim();
    const u = normalizeSocialUrl(v);
    if (u) out[key] = u;
  }
  return out;
}

export function parseShopSocialLinksJson(raw: unknown): ShopSocialLinksRecord {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: ShopSocialLinksRecord = {};
  for (const key of SHOP_SOCIAL_KEYS) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}
