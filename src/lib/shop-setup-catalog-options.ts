import type { AdminCatalogVariant } from "@/lib/admin-catalog-item";
import {
  parseAdminCatalogVariantsJson,
  parseProductIdFromListingExampleUrl,
  parseProductSlugFromExampleUrl,
} from "@/lib/admin-catalog-item";

export type ShopSetupCatalogOption = {
  productId: string;
  label: string;
  minPriceCents: number;
  priceCents: number;
  exampleHref: string;
};

export type CatalogProductRow = {
  id: string;
  slug: string;
  name: string;
  minPriceCents: number;
  priceCents: number;
};

export type AdminCatalogRow = {
  name: string;
  variants: unknown;
  itemPlatformProductId: string | null;
  itemExampleListingUrl: string | null;
  itemMinPriceCents: number;
};

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function productFloorCents(p: Pick<CatalogProductRow, "minPriceCents" | "priceCents">): number {
  return p.minPriceCents > 0 ? p.minPriceCents : p.priceCents;
}

function exampleHrefFor(productId: string, rawUrl: string): string {
  const t = rawUrl.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) return t;
  return `/admin?tab=printify&listing=${encodeURIComponent(productId)}`;
}

type ProductIndexes = {
  byId: Map<string, CatalogProductRow>;
  bySlug: Map<string, CatalogProductRow>;
  byNameNorm: Map<string, CatalogProductRow>;
};

function buildProductIndexes(products: CatalogProductRow[]): ProductIndexes {
  return {
    byId: new Map(products.map((p) => [p.id, p])),
    bySlug: new Map(products.map((p) => [p.slug.trim().toLowerCase(), p])),
    byNameNorm: new Map(products.map((p) => [normName(p.name), p])),
  };
}

/**
 * Map an Admin List row (and optional variant) to a platform Product id:
 * 0. Explicit `itemPlatformProductId` / variant `platformProductId` when set (optional example URL)
 * 1. `listing=<id>` in the example URL
 * 2. `/product/<slug>` (or `/embed/product/<slug>`) in the example URL
 * 3. Product name match: `{item} — {variant}` or variant label only or item name only
 */
export function resolveCatalogProductIdForAdminEntry(
  item: AdminCatalogRow,
  variant: AdminCatalogVariant | null,
  idx: ProductIndexes,
): string | null {
  if (variant) {
    const ex = variant.platformProductId?.trim() ?? "";
    if (ex && idx.byId.has(ex)) return ex;
  } else {
    const ex = item.itemPlatformProductId?.trim() ?? "";
    if (ex && idx.byId.has(ex)) return ex;
  }

  const url = variant ? variant.exampleListingUrl : (item.itemExampleListingUrl ?? "");

  const fromListing = parseProductIdFromListingExampleUrl(url);
  if (fromListing && idx.byId.has(fromListing)) return fromListing;

  const slug = parseProductSlugFromExampleUrl(url);
  if (slug) {
    const p = idx.bySlug.get(slug.trim().toLowerCase());
    if (p) return p.id;
  }

  if (variant) {
    const composite = normName(`${item.name} — ${variant.label}`);
    let p = idx.byNameNorm.get(composite);
    if (p) return p.id;
    p = idx.byNameNorm.get(normName(variant.label));
    if (p) return p.id;
  } else {
    const p = idx.byNameNorm.get(normName(item.name));
    if (p) return p.id;
  }
  return null;
}

/**
 * Rows for the shop dashboard “Product catalog” picker from Admin → List, resolved to active Printify
 * products (explicit linked id, then example URL, then name match). One picker row per product id (first
 * matching admin row wins).
 */
export function buildShopSetupCatalogOptions(
  adminItems: AdminCatalogRow[],
  printifyProducts: CatalogProductRow[],
): ShopSetupCatalogOption[] {
  const idx = buildProductIndexes(printifyProducts);
  const out: ShopSetupCatalogOption[] = [];
  const seenProductIds = new Set<string>();

  for (const item of adminItems) {
    const variants = parseAdminCatalogVariantsJson(item.variants);
    if (variants.length === 0) {
      const pid = resolveCatalogProductIdForAdminEntry(item, null, idx);
      if (!pid || seenProductIds.has(pid)) continue;
      const p = idx.byId.get(pid)!;
      seenProductIds.add(pid);
      const url = item.itemExampleListingUrl ?? "";
      out.push({
        productId: pid,
        label: item.name,
        minPriceCents: Math.max(item.itemMinPriceCents, productFloorCents(p)),
        priceCents: p.priceCents,
        exampleHref: exampleHrefFor(pid, url),
      });
    } else {
      for (const v of variants) {
        const pid = resolveCatalogProductIdForAdminEntry(item, v, idx);
        if (!pid || seenProductIds.has(pid)) continue;
        const p = idx.byId.get(pid)!;
        seenProductIds.add(pid);
        out.push({
          productId: pid,
          label: `${item.name} — ${v.label}`,
          minPriceCents: Math.max(v.minPriceCents, productFloorCents(p)),
          priceCents: p.priceCents,
          exampleHref: exampleHrefFor(pid, v.exampleListingUrl),
        });
      }
    }
  }
  return out;
}

/**
 * Minimum list price for a Printify product: platform floor, or max(platform floor, admin catalog min)
 * when the product is linked from an Admin List row (same resolution rules as the picker).
 */
export function minListPriceCentsForProductFromAdminCatalog(
  productId: string,
  adminItems: AdminCatalogRow[],
  product: CatalogProductRow,
  allPrintifyProducts: CatalogProductRow[],
): number {
  const floor = productFloorCents(product);
  const idx = buildProductIndexes(allPrintifyProducts);
  let adminMax = 0;
  let found = false;
  for (const item of adminItems) {
    const variants = parseAdminCatalogVariantsJson(item.variants);
    if (variants.length === 0) {
      const pid = resolveCatalogProductIdForAdminEntry(item, null, idx);
      if (pid !== productId) continue;
      found = true;
      adminMax = Math.max(adminMax, item.itemMinPriceCents);
    } else {
      for (const v of variants) {
        const pid = resolveCatalogProductIdForAdminEntry(item, v, idx);
        if (pid !== productId) continue;
        found = true;
        adminMax = Math.max(adminMax, v.minPriceCents);
      }
    }
  }
  if (!found) return floor;
  return Math.max(floor, adminMax);
}
