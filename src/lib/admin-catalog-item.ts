import { randomUUID } from "node:crypto";

export type AdminCatalogVariant = {
  id: string;
  label: string;
  minPriceCents: number;
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
    if (!id) id = randomUUID();
    const pcRaw = o.minPriceCents;
    let minPriceCents = 0;
    if (typeof pcRaw === "number" && Number.isFinite(pcRaw)) {
      minPriceCents = Math.max(0, Math.round(pcRaw));
    }
    const exampleListingUrl =
      typeof o.exampleListingUrl === "string" ? o.exampleListingUrl.trim() : "";
    let platformProductId: string | undefined;
    const pidRaw = o.platformProductId;
    if (typeof pidRaw === "string" && pidRaw.trim()) {
      platformProductId = pidRaw.trim();
    }
    out.push({
      id,
      label,
      minPriceCents,
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
    exampleListingUrl: string;
    platformProductId?: string;
  }[],
): AdminCatalogVariant[] {
  return input
    .filter((v) => v.label.trim().length > 0)
    .map((v) => {
      const pid = v.platformProductId?.trim();
      return {
        id: randomUUID(),
        label: v.label.trim(),
        minPriceCents: Math.max(0, Math.round(v.minPriceCents)),
        exampleListingUrl: v.exampleListingUrl.trim(),
        ...(pid ? { platformProductId: pid } : {}),
      };
    });
}

/** Form state for one variant row (add / edit UI). */
export type AdminCatalogVariantFormRow = {
  label: string;
  minPriceDollars: string;
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
    exampleListingUrl: v.exampleListingUrl,
    platformProductId: v.platformProductId ?? "",
  }));
}

export type CatalogVariantPayloadRow = {
  label: string;
  minPriceDollars: string;
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
      exampleListingUrl: row.exampleListingUrl.trim(),
      platformProductId: row.platformProductId.trim(),
    }))
    .filter(
      (row) =>
        row.label.length > 0 ||
        row.minPriceDollars.length > 0 ||
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
  }
  return { ok: true, payload };
}

/**
 * When an item has no variants: minimum USD price is required; example listing URL is optional.
 */
export function validateItemLevelWhenNoVariants(
  exampleListingUrl: string,
  minPriceDollars: string,
):
  | { ok: true; exampleListingUrl: string | null; minPriceCents: number }
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
  return {
    ok: true,
    exampleListingUrl: url ? url.slice(0, 2048) : null,
    minPriceCents: Math.round(n * 100),
  };
}
