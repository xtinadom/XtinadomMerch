function newRandomUuid(): string {
  return globalThis.crypto.randomUUID();
}

export type AdminCatalogVariant = {
  id: string;
  label: string;
  minPriceCents: number;
  /** Fulfillment / COGS per unit (cents); retained by platform before marketplace fee. */
  goodsServicesCostCents: number;
  exampleListingUrl: string;
  /** Optional storefront Product id (active Printify) when example URL / name match is not used. */
  platformProductId?: string;
};

/**
 * Extract platform `Product.id` from admin / example URLs that include `listing=<id>`
 * (e.g. `/admin?tab=printify&listing=clxxx`).
 */
export function parseProductIdFromListingExampleUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  const m = t.match(/[?&]listing=([^&]+)/);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1].trim());
  } catch {
    return m[1].trim();
  }
}

/** Storefront slug from `/product/slug` or `/embed/product/slug` (absolute or relative URL). */
export function parseProductSlugFromExampleUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  const fromPath = (path: string) => {
    const m = path.match(/\/(?:embed\/)?product\/([^/?#]+)/i);
    if (!m?.[1]) return null;
    try {
      return decodeURIComponent(m[1].trim());
    } catch {
      return m[1].trim();
    }
  };
  if (t.startsWith("/")) return fromPath(t);
  try {
    return fromPath(new URL(t).pathname);
  } catch {
    return fromPath(t);
  }
}

export function parseAdminCatalogVariantsJson(raw: unknown): AdminCatalogVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: AdminCatalogVariant[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) continue;
    let id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
    if (!id) id = newRandomUuid();
    const pcRaw = o.minPriceCents;
    let minPriceCents = 0;
    if (typeof pcRaw === "number" && Number.isFinite(pcRaw)) {
      minPriceCents = Math.max(0, Math.round(pcRaw));
    }
    const exampleListingUrl =
      typeof o.exampleListingUrl === "string" ? o.exampleListingUrl.trim() : "";
    const gsRaw = o.goodsServicesCostCents;
    let goodsServicesCostCents = 0;
    if (typeof gsRaw === "number" && Number.isFinite(gsRaw)) {
      goodsServicesCostCents = Math.max(0, Math.round(gsRaw));
    }
    let platformProductId: string | undefined;
    const pidRaw = o.platformProductId;
    if (typeof pidRaw === "string" && pidRaw.trim()) {
      platformProductId = pidRaw.trim();
    }
    out.push({
      id,
      label,
      minPriceCents,
      goodsServicesCostCents,
      exampleListingUrl,
      ...(platformProductId ? { platformProductId } : {}),
    });
  }
  return out;
}

export function dollarsStringFromCents(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

/**
 * Minimum USD list price is required; example listing URL is optional.
 */
export function validateItemLevelWhenNoVariants(
  exampleListingUrl: string,
  minPriceDollars: string,
  itemGoodsServicesCostDollars = "",
):
  | { ok: true; exampleListingUrl: string | null; minPriceCents: number; itemGoodsServicesCostCents: number }
  | { ok: false; error: string } {
  const url = exampleListingUrl.trim();
  const n = parseFloat(minPriceDollars.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    return {
      ok: false,
      error: "Enter a valid minimum price in USD.",
    };
  }
  const gsRaw = itemGoodsServicesCostDollars.trim();
  let itemGoodsServicesCostCents = 0;
  if (gsRaw.length > 0) {
    const gn = parseFloat(gsRaw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(gn) || gn < 0) {
      return {
        ok: false,
        error: "Enter a valid goods/services cost in USD (or leave blank for none).",
      };
    }
    itemGoodsServicesCostCents = Math.round(gn * 100);
  }
  return {
    ok: true,
    exampleListingUrl: url ? url.slice(0, 2048) : null,
    minPriceCents: Math.round(n * 100),
    itemGoodsServicesCostCents,
  };
}
