import type { Tag } from "@/generated/prisma/client";
import { Audience } from "@/generated/prisma/enums";
import type { ProductCardProduct } from "@/components/ProductCard";
import type { ShopSectionRow } from "@/lib/shop-browse-sections";
import { designNamesFromJson } from "@/lib/product-design-names";
import { productHasTag } from "@/lib/product-tags";

export type BuildByItemCatalogMode = "sub" | "domme" | "all";

function productInSubCollection(p: ProductCardProduct): boolean {
  return p.audience === Audience.sub || p.audience === Audience.both;
}

function productInDommeCollection(p: ProductCardProduct): boolean {
  return p.audience === Audience.domme || p.audience === Audience.both;
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
 * One product per store tag for a single collection view, or up to two (Sub + Domme)
 * on the all-products view. Uses admin “top pick” per collection when valid.
 */
export function buildByItemOnePerTag(
  allProducts: ProductCardProduct[],
  tags: Tag[],
  options: { catalog: BuildByItemCatalogMode },
): ShopSectionRow[] {
  const { catalog } = options;
  const rows: ShopSectionRow[] = [];

  if (catalog === "sub" || catalog === "domme") {
    for (const tag of tags) {
      const match = allProducts.filter((p) => productHasTag(p, tag.id));
      if (match.length === 0) continue;
      const spotlightId =
        catalog === "sub"
          ? tag.subCollectionSpotlightProductId
          : tag.dommeCollectionSpotlightProductId;
      const one = pickOneForTag(match, spotlightId);
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
  } else {
    for (const tag of tags) {
      const subMatch = allProducts.filter(
        (p) => productHasTag(p, tag.id) && productInSubCollection(p),
      );
      const dommeMatch = allProducts.filter(
        (p) => productHasTag(p, tag.id) && productInDommeCollection(p),
      );
      if (subMatch.length === 0 && dommeMatch.length === 0) continue;

      const subOne = pickOneForTag(subMatch, tag.subCollectionSpotlightProductId);
      const dommeOne = pickOneForTag(
        dommeMatch,
        tag.dommeCollectionSpotlightProductId,
      );

      const products: ProductCardProduct[] = [];
      if (subOne) products.push(subOne);
      if (dommeOne && dommeOne.id !== subOne?.id) products.push(dommeOne);

      if (products.length === 0) continue;
      rows.push({
        tag: {
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          sortOrder: tag.sortOrder,
        },
        products,
      });
    }
  }

  const untagged = allProducts.filter((p) => p.tags.length === 0);
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
