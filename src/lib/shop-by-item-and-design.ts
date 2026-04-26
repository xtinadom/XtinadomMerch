import type { Tag } from "@/generated/prisma/client";
import type { ProductCardProduct } from "@/components/ProductCard";
import type { ShopSectionRow } from "@/lib/shop-browse-sections";
import { designNamesFromJson } from "@/lib/product-design-names";
import { productHasTag } from "@/lib/product-tags";

function spotlightProductIdForTag(tag: Tag): string | null | undefined {
  return tag.byItemSpotlightProductId;
}

function pickOneForTag(
  match: ProductCardProduct[],
  spotlightId: string | null | undefined,
): ProductCardProduct | null {
  if (match.length === 0) return null;
  const sid = spotlightId?.trim();
  const spotlight =
    sid && match.some((p) => p.id === sid)
      ? (match.find((p) => p.id === sid) ?? null)
      : null;
  return spotlight ?? match[0]!;
}

/**
 * One product per store tag for the By Item browse. Uses admin “top pick” when valid.
 */
export function buildByItemOnePerTag(
  allProducts: ProductCardProduct[],
  tags: Tag[],
): ShopSectionRow[] {
  const rows: ShopSectionRow[] = [];

  for (const tag of tags) {
    const match = allProducts.filter((p) => productHasTag(p, tag.id));
    if (match.length === 0) continue;
    const one = pickOneForTag(match, spotlightProductIdForTag(tag));
    if (!one) continue;
    rows.push({
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        sortOrder: tag.sortOrder,
      },
      products: [one],
    });
  }

  const untagged = allProducts.filter(
    (p) => p.tags.length === 0 && !(p.primaryTagId?.trim()),
  );
  if (untagged[0]) {
    rows.push({
      tag: {
        id: "__untagged__",
        name: "Other products",
        slug: "",
        sortOrder: 999,
      },
      products: [untagged[0]],
    });
  }
  return rows;
}

function productHasDesignName(p: ProductCardProduct, design: string): boolean {
  const k = design.toLowerCase();
  return designNamesFromJson(p.designNames).some((n) => n.toLowerCase() === k);
}

/** Stable id for a design-name row (slug stays empty — no tag URL). */
function designRowId(displayName: string): string {
  return `design:${encodeURIComponent(displayName)}`;
}

/** All products per distinct design name (name order within each row). */
export function buildByDesignAllPerName(allProducts: ProductCardProduct[]): ShopSectionRow[] {
  const canonical = new Map<string, string>();
  for (const p of allProducts) {
    for (const n of designNamesFromJson(p.designNames)) {
      const low = n.toLowerCase();
      if (!canonical.has(low)) canonical.set(low, n);
    }
  }
  const sorted = [...canonical.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const rows: ShopSectionRow[] = [];
  for (const displayName of sorted) {
    const match = allProducts
      .filter((p) => productHasDesignName(p, displayName))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    if (match.length === 0) continue;
    rows.push({
      tag: {
        id: designRowId(displayName),
        name: displayName,
        slug: "",
        sortOrder: 0,
      },
      products: match,
    });
  }
  return rows;
}

/** One product per distinct design name (first in name order among matches). */
export function buildByDesignOnePerName(
  allProducts: ProductCardProduct[],
): ShopSectionRow[] {
  const canonical = new Map<string, string>();
  for (const p of allProducts) {
    for (const n of designNamesFromJson(p.designNames)) {
      const low = n.toLowerCase();
      if (!canonical.has(low)) canonical.set(low, n);
    }
  }
  const sorted = [...canonical.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const rows: ShopSectionRow[] = [];
  for (const displayName of sorted) {
    const match = allProducts.filter((p) => productHasDesignName(p, displayName));
    const one = match[0];
    if (!one) continue;
    rows.push({
      tag: {
        id: designRowId(displayName),
        name: displayName,
        slug: "",
        sortOrder: 0,
      },
      products: [one],
    });
  }
  return rows;
}
