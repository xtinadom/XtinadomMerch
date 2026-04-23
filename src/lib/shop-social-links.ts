export const SHOP_SOCIAL_KEYS = [
  "reddit",
  "x",
  "bluesky",
  "twitch",
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

function parseHttpsUrl(raw: string): URL | null {
  const normalized = normalizeSocialUrl(raw);
  if (!normalized) return null;
  try {
    const u = new URL(normalized);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u;
  } catch {
    return null;
  }
}

const PLATFORM_HOST_RULES: Record<ShopSocialKey, (host: string) => boolean> = {
  reddit: (h) => h === "reddit.com" || h.endsWith(".reddit.com"),
  x: (h) =>
    h === "x.com" ||
    h.endsWith(".x.com") ||
    h === "twitter.com" ||
    h.endsWith(".twitter.com"),
  bluesky: (h) =>
    h === "bsky.app" ||
    h.endsWith(".bsky.app") ||
    h === "bsky.social" ||
    h.endsWith(".bsky.social"),
  twitch: (h) => h === "twitch.tv" || h.endsWith(".twitch.tv"),
  instagram: (h) => h === "instagram.com" || h.endsWith(".instagram.com"),
};

const PLATFORM_URL_HINT: Record<ShopSocialKey, string> = {
  reddit: "reddit.com",
  x: "x.com or twitter.com",
  bluesky: "bsky.app or *.bsky.social",
  twitch: "twitch.tv",
  instagram: "instagram.com",
};

const PLATFORM_NAME: Record<ShopSocialKey, string> = {
  reddit: "Reddit",
  x: "X",
  bluesky: "Bluesky",
  twitch: "Twitch",
  instagram: "Instagram",
};

/** True when the URL’s host is that network (e.g. reddit.com), not another site. */
export function socialUrlMatchesPlatform(key: ShopSocialKey, raw: string): boolean {
  const url = parseHttpsUrl(raw);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return PLATFORM_HOST_RULES[key](host);
}

/** If the URL is invalid or the host does not match the chosen network, return a user-facing message. */
export function socialLinkAddValidationMessage(
  key: ShopSocialKey,
  raw: string,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!parseHttpsUrl(trimmed)) {
    return "Enter a valid http(s) URL.";
  }
  if (!socialUrlMatchesPlatform(key, trimmed)) {
    return `That URL is not on ${PLATFORM_URL_HINT[key]}, which is required for ${PLATFORM_NAME[key]}.`;
  }
  return null;
}

/** Canonical stored URL (https, parsed) or null if invalid. */
export function normalizedShopSocialUrl(raw: string): string | null {
  const url = parseHttpsUrl(raw);
  return url ? url.href : null;
}

/** Parse form keys `social_reddit`, … into a JSON-ready object (only non-empty, valid hosts). */
export function shopSocialLinksFromFormData(formData: FormData): ShopSocialLinksRecord {
  const out: ShopSocialLinksRecord = {};
  for (const key of SHOP_SOCIAL_KEYS) {
    const v = String(formData.get(`social_${key}`) ?? "").trim();
    const u = normalizedShopSocialUrl(v);
    if (u && socialUrlMatchesPlatform(key, v)) out[key] = u;
  }
  return out;
}

/**
 * When any `social_*` field is non-empty but invalid or the host does not match that network,
 * returns a user-facing error (for server-side profile save).
 */
export function shopSocialLinksFormValidationError(formData: FormData): string | null {
  for (const key of SHOP_SOCIAL_KEYS) {
    const v = String(formData.get(`social_${key}`) ?? "").trim();
    if (!v) continue;
    const msg = socialLinkAddValidationMessage(key, v);
    if (msg) return msg;
    if (!normalizedShopSocialUrl(v)) return "Enter a valid http(s) URL.";
  }
  return null;
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
