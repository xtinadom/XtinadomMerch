import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";

/** Picker / form value: opaque token, not a storefront Product id until submit. */
const PICK_PREFIX = "ab|";

/** One selectable line (single item or one variant under an item). */
export type ShopSetupCatalogOption = {
  /** Baseline pick token (submitted as `productId`); server maps to a stub Product. */
  productId: string;
  label: string;
  minPriceCents: number;
  priceCents: number;
  exampleHref: string | null;
  /** Unit goods/services (COGS) from admin baseline — used for estimated shop profit at list price. */
  goodsServicesCostCents: number;
};

export type ShopSetupCatalogVariantLine = {
  productId: string;
  variantLabel: string;
  minPriceCents: number;
  priceCents: number;
  exampleHref: string | null;
  goodsServicesCostCents: number;
};

/** One admin item: either a single selectable row or a parent with nested variants. */
export type ShopSetupCatalogGroup =
  | {
      itemId: string;
      itemName: string;
      kind: "single";
      option: Omit<ShopSetupCatalogOption, "label">;
    }
  | {
      itemId: string;
      itemName: string;
      kind: "variants";
      variants: ShopSetupCatalogVariantLine[];
    };

/** Flat list for resolving selection (price min, labels). */
export function flattenShopBaselineCatalogGroups(groups: ShopSetupCatalogGroup[]): ShopSetupCatalogOption[] {
  const out: ShopSetupCatalogOption[] = [];
  for (const g of groups) {
    if (g.kind === "single") {
      out.push({
        productId: g.option.productId,
        label: g.itemName,
        minPriceCents: g.option.minPriceCents,
        priceCents: g.option.priceCents,
        exampleHref: g.option.exampleHref,
        goodsServicesCostCents: g.option.goodsServicesCostCents,
      });
    } else {
      for (const v of g.variants) {
        out.push({
          productId: v.productId,
          label: `${g.itemName} — ${v.variantLabel}`,
          minPriceCents: v.minPriceCents,
          priceCents: v.priceCents,
          exampleHref: v.exampleHref,
          goodsServicesCostCents: v.goodsServicesCostCents,
        });
      }
    }
  }
  return out;
}

export type AdminBaselineRow = {
  id: string;
  name: string;
  variants: unknown;
  itemExampleListingUrl: string | null;
  itemMinPriceCents: number;
  itemGoodsServicesCostCents: number;
};

export type ParsedBaselinePick =
  | { mode: "item"; itemId: string }
  | { mode: "variant"; itemId: string; variantId: string }
  | { mode: "allVariants"; itemId: string };

export function encodeBaselinePickItem(itemId: string): string {
  return `${PICK_PREFIX}${itemId}|item`;
}

export function encodeBaselinePickVariant(itemId: string, variantId: string): string {
  return `${PICK_PREFIX}${itemId}|var|${variantId}`;
}

/** Submit every variant under this admin item together (same artwork). */
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
 * Shop “Add to store” options grouped by admin item; variants nest under one parent name.
 */
export function buildShopBaselineCatalogGroups(items: AdminBaselineRow[]): ShopSetupCatalogGroup[] {
  const out: ShopSetupCatalogGroup[] = [];
  for (const item of items) {
    const variants = parseAdminCatalogVariantsJson(item.variants);
    if (variants.length === 0) {
      out.push({
        itemId: item.id,
        itemName: item.name,
        kind: "single",
        option: {
          productId: encodeBaselinePickItem(item.id),
          minPriceCents: Math.max(0, item.itemMinPriceCents),
          priceCents: Math.max(0, item.itemMinPriceCents),
          exampleHref: exampleHrefFromAdminUrl(item.itemExampleListingUrl),
          goodsServicesCostCents: Math.max(0, item.itemGoodsServicesCostCents),
        },
      });
    } else {
      out.push({
        itemId: item.id,
        itemName: item.name,
        kind: "variants",
        variants: variants.map((v) => ({
          productId: encodeBaselinePickVariant(item.id, v.id),
          variantLabel: v.label,
          minPriceCents: Math.max(0, v.minPriceCents),
          priceCents: Math.max(0, v.minPriceCents),
          exampleHref: exampleHrefFromAdminUrl(v.exampleListingUrl),
          goodsServicesCostCents: Math.max(0, v.goodsServicesCostCents ?? 0),
        })),
      });
    }
  }
  return out;
}
