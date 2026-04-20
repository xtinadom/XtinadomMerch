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

export function normalizeNewVariants(
  input: {
    label: string;
    minPriceCents: number;
    goodsServicesCostCents?: number;
    exampleListingUrl: string;
    platformProductId?: string;
  }[],
): AdminCatalogVariant[] {
  return input
    .filter((v) => v.label.trim().length > 0)
    .map((v) => {
      const pid = v.platformProductId?.trim();
      const gs =
        typeof v.goodsServicesCostCents === "number" && Number.isFinite(v.goodsServicesCostCents)
          ? Math.max(0, Math.round(v.goodsServicesCostCents))
          : 0;
      return {
        id: newRandomUuid(),
        label: v.label.trim(),
        minPriceCents: Math.max(0, Math.round(v.minPriceCents)),
        goodsServicesCostCents: gs,
        exampleListingUrl: v.exampleListingUrl.trim(),
        ...(pid ? { platformProductId: pid } : {}),
      };
    });
}

/** Form state for one variant row (add / edit UI). */
export type AdminCatalogVariantFormRow = {
  label: string;
  minPriceDollars: string;
  goodsServicesCostDollars: string;
  exampleListingUrl: string;
  platformProductId: string;
};

export function dollarsStringFromCents(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export function variantsToFormRows(variants: AdminCatalogVariant[]): AdminCatalogVariantFormRow[] {
  return variants.map((v) => ({
    label: v.label,
    minPriceDollars: dollarsStringFromCents(v.minPriceCents),
    goodsServicesCostDollars: dollarsStringFromCents(v.goodsServicesCostCents ?? 0),
    exampleListingUrl: v.exampleListingUrl,
    platformProductId: v.platformProductId ?? "",
  }));
}

export type CatalogVariantPayloadRow = {
  label: string;
  minPriceDollars: string;
  goodsServicesCostDollars: string;
  exampleListingUrl: string;
  platformProductId: string;
};

/**
 * Validates non-empty variant rows (any field set requires label + valid USD price).
 * Returns JSON-ready rows for server actions (same shape as add/edit payloads).
 */
export function validateCatalogVariantFormRows(rows: AdminCatalogVariantFormRow[]):
  | { ok: true; payload: CatalogVariantPayloadRow[] }
  | { ok: false; error: string } {
  const payload = rows
    .map((row) => ({
      label: row.label.trim(),
      minPriceDollars: row.minPriceDollars.trim(),
      goodsServicesCostDollars: row.goodsServicesCostDollars.trim(),
      exampleListingUrl: row.exampleListingUrl.trim(),
      platformProductId: row.platformProductId.trim(),
    }))
    .filter(
      (row) =>
        row.label.length > 0 ||
        row.minPriceDollars.length > 0 ||
        row.goodsServicesCostDollars.length > 0 ||
        row.exampleListingUrl.length > 0 ||
        row.platformProductId.length > 0,
    );

  for (const row of payload) {
    if (!row.label) {
      return { ok: false, error: "Each variant needs a name." };
    }
    const n = parseFloat(row.minPriceDollars.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: `Invalid minimum price for “${row.label}”.` };
    }
    if (row.goodsServicesCostDollars.length > 0) {
      const g = parseFloat(row.goodsServicesCostDollars.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(g) || g < 0) {
        return { ok: false, error: `Invalid goods/services cost for “${row.label}”.` };
      }
    }
  }
  return { ok: true, payload };
}

/**
 * When an item has no variants: minimum USD price is required; example listing URL is optional.
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
      error:
        "Enter a valid minimum price in USD (required when the item has no variants).",
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
