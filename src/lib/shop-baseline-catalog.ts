/** Picker / form value: opaque token, not a storefront Product id until submit. */
const PICK_PREFIX = "ab|";

/** One selectable catalog line (one admin baseline item). */
export type ShopSetupCatalogOption = {
  /** Baseline pick token (submitted as `productId`); server maps to a stub Product. */
  productId: string;
  label: string;
  minPriceCents: number;
  priceCents: number;
  exampleHref: string | null;
  /** Unit goods/services (COGS) from admin baseline — used for estimated shop profit at list price. */
  goodsServicesCostCents: number;
  /** Admin copy for print/DPI expectations; shown when {@link minArtworkLongEdgePx} is set. */
  imageRequirementLabel: string | null;
  /** When set, artwork longest edge (px) must be at least this value. */
  minArtworkLongEdgePx: number | null;
};

/** One admin catalog item as a single selectable row. */
export type ShopSetupCatalogGroup = {
  itemId: string;
  itemName: string;
  option: Omit<ShopSetupCatalogOption, "label">;
};

/** Flat list for resolving selection (price min, labels). */
export function flattenShopBaselineCatalogGroups(groups: ShopSetupCatalogGroup[]): ShopSetupCatalogOption[] {
  return groups.map((g) => ({
    productId: g.option.productId,
    label: g.itemName,
    minPriceCents: g.option.minPriceCents,
    priceCents: g.option.priceCents,
    exampleHref: g.option.exampleHref,
    goodsServicesCostCents: g.option.goodsServicesCostCents,
    imageRequirementLabel: g.option.imageRequirementLabel,
    minArtworkLongEdgePx: g.option.minArtworkLongEdgePx,
  }));
}

export type AdminBaselineRow = {
  id: string;
  name: string;
  /** @deprecated Legacy field; ignored for catalog display. */
  variants?: unknown;
  itemExampleListingUrl: string | null;
  itemMinPriceCents: number;
  itemGoodsServicesCostCents: number;
  itemImageRequirementLabel: string | null;
  itemMinArtworkLongEdgePx: number | null;
};

export type ParsedBaselinePick =
  | { mode: "item"; itemId: string }
  | { mode: "variant"; itemId: string; variantId: string }
  | { mode: "allVariants"; itemId: string };

export function encodeBaselinePickItem(itemId: string): string {
  return `${PICK_PREFIX}${itemId}|item`;
}

/** @deprecated Legacy encoded picks may still appear in the database. */
export function encodeBaselinePickVariant(itemId: string, variantId: string): string {
  return `${PICK_PREFIX}${itemId}|var|${variantId}`;
}

/** @deprecated Legacy encoded picks may still appear in the database. */
export function encodeBaselinePickAllVariants(itemId: string): string {
  return `${PICK_PREFIX}${itemId}|all`;
}

export function parseBaselinePick(raw: string): ParsedBaselinePick | null {
  const t = raw.trim();
  if (!t.startsWith(PICK_PREFIX)) return null;
  const parts = t.slice(PICK_PREFIX.length).split("|");
  if (parts.length === 2 && parts[1] === "item" && parts[0]) {
    return { mode: "item", itemId: parts[0] };
  }
  if (parts.length === 2 && parts[1] === "all" && parts[0]) {
    return { mode: "allVariants", itemId: parts[0] };
  }
  if (parts.length === 3 && parts[1] === "var" && parts[0] && parts[2]) {
    return { mode: "variant", itemId: parts[0], variantId: parts[2] };
  }
  return null;
}

function exampleHrefFromAdminUrl(raw: string | null | undefined): string | null {
  const u = String(raw ?? "").trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return u;
  return null;
}

/**
 * Shop “Add to store” options: one row per admin catalog item (item-level pricing only).
 */
export function buildShopBaselineCatalogGroups(items: AdminBaselineRow[]): ShopSetupCatalogGroup[] {
  const out: ShopSetupCatalogGroup[] = [];
  for (const item of items) {
    out.push({
      itemId: item.id,
      itemName: item.name,
      option: {
        productId: encodeBaselinePickItem(item.id),
        minPriceCents: Math.max(0, item.itemMinPriceCents),
        priceCents: Math.max(0, item.itemMinPriceCents),
        exampleHref: exampleHrefFromAdminUrl(item.itemExampleListingUrl),
        goodsServicesCostCents: Math.max(0, item.itemGoodsServicesCostCents),
        imageRequirementLabel: item.itemImageRequirementLabel?.trim() || null,
        minArtworkLongEdgePx:
          item.itemMinArtworkLongEdgePx != null && item.itemMinArtworkLongEdgePx > 0
            ? item.itemMinArtworkLongEdgePx
            : null,
      },
    });
  }
  return out;
}
