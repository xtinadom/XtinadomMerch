/** Types + parsing for Printify catalog sync (images, prices, variants). */

export type PrintifyCatalogImage = { src: string; variantIds: string[] };

export type PrintifyCatalogVariant = {
  /** Printify may use integer ids or string ids (e.g. Mongo-style) depending on product/version. */
  id: string;
  title: string;
  priceCents: number;
  enabled: boolean;
  /** Printify variant SKU when present (used to dedupe catalog admin views). */
  sku: string | null;
};

export type PrintifyCatalogProduct = {
  id: string;
  title: string;
  description: string | null;
  variants: PrintifyCatalogVariant[];
  images: PrintifyCatalogImage[];
  /** From Printify `updated_at` / `created_at` when present (ISO). */
  updatedAt: Date | null;
};

function parseImages(raw: unknown): PrintifyCatalogImage[] {
  if (!Array.isArray(raw)) return [];
  const out: PrintifyCatalogImage[] = [];
  for (const img of raw) {
    if (!img || typeof img !== "object") continue;
    const o = img as Record<string, unknown>;
    const srcRaw = o.src ?? o.url ?? o.preview_url;
    const src = typeof srcRaw === "string" && srcRaw.trim() ? srcRaw.trim() : "";
    if (!src) continue;
    const idsRaw = o.variant_ids ?? o.variantIds;
    const variantIds: string[] = [];
    if (Array.isArray(idsRaw)) {
      for (const x of idsRaw) {
        if (typeof x === "number" && Number.isFinite(x)) {
          variantIds.push(String(Math.trunc(x)));
        } else if (typeof x === "string" && x.trim()) {
          variantIds.push(x.trim());
        }
      }
    }
    out.push({ src, variantIds });
  }
  return out;
}

function parseVariantIdFromApi(vr: Record<string, unknown>): string | null {
  const raw = vr.id;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return null;
}

function parseVariants(raw: unknown): PrintifyCatalogVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: PrintifyCatalogVariant[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const vr = v as Record<string, unknown>;
    const vid = parseVariantIdFromApi(vr);
    if (!vid) continue;
    const title =
      typeof vr.title === "string" && vr.title.trim()
        ? vr.title.trim()
        : `Variant ${vid}`;
    const priceRaw = vr.price;
    let priceCents = 0;
    if (typeof priceRaw === "number" && Number.isFinite(priceRaw)) {
      priceCents = Math.max(0, Math.round(priceRaw));
    } else if (typeof priceRaw === "string") {
      const n = parseInt(priceRaw, 10);
      if (Number.isFinite(n)) priceCents = Math.max(0, n);
    }
    const enabled =
      typeof vr.is_enabled === "boolean"
        ? vr.is_enabled
        : typeof vr.is_available === "boolean"
          ? vr.is_available
          : true;
    const skuRaw = vr.sku;
    const sku =
      typeof skuRaw === "string" && skuRaw.trim()
        ? skuRaw.trim()
        : null;
    out.push({ id: vid, title, priceCents, enabled, sku });
  }
  return out;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value.trim());
  return Number.isFinite(d.getTime()) ? d : null;
}

export function parsePrintifyProductRow(row: unknown): PrintifyCatalogProduct | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : "";
  if (!id) return null;
  const title = typeof r.title === "string" ? r.title.trim() || "(untitled)" : "(untitled)";
  const description =
    typeof r.description === "string" && r.description.trim()
      ? r.description.trim()
      : null;
  const variants = parseVariants(r.variants);
  const images = parseImages(r.images);
  const updatedAt =
    parseIsoDate(r.updated_at) ??
    parseIsoDate(r.updatedAt) ??
    parseIsoDate(r.created_at) ??
    parseIsoDate(r.createdAt) ??
    null;
  return { id, title, description, variants, images, updatedAt };
}

export function pickImageForVariant(
  images: PrintifyCatalogImage[],
  variantId: string,
): string | null {
  if (images.length === 0) return null;
  const direct = images.find((i) => i.variantIds.includes(variantId));
  if (direct?.src) return direct.src;
  const generic = images.find((i) => i.variantIds.length === 0);
  if (generic?.src) return generic.src;
  return images[0]?.src ?? null;
}

/** Display name for a variant row */
export function printifyVariantDisplayName(productTitle: string, variantTitle: string): string {
  const vt = variantTitle.trim();
  const generic =
    /^default$/i.test(vt) ||
    /^default title$/i.test(vt) ||
    /^variant \d+$/i.test(vt);
  if (generic || !vt) return productTitle.trim();
  return `${productTitle.trim()} — ${vt}`;
}

export function catalogRowNeedsDetail(p: PrintifyCatalogProduct): boolean {
  if (p.images.length === 0) return true;
  if (p.variants.some((v) => v.priceCents <= 0 && v.enabled)) return true;
  return false;
}

/** Checkout / default line: first enabled variant, else first variant (string id for forms). */
export function defaultPrintifyVariantIdForCatalogProduct(p: {
  variants: PrintifyCatalogVariant[];
}): string | null {
  if (p.variants.length === 0) return null;
  const enabled = p.variants.filter((v) => v.enabled);
  const first = (enabled.length > 0 ? enabled : p.variants)[0];
  return first?.id ?? null;
}
