import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";
import { buildPrintifyIdToCatalogVariantIdMap } from "@/lib/shop-listing-catalog-variant-price-remap";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import { parsePrintifyVariantsJson } from "@/lib/printify-variants";

export type BaselineCatalogRowForGoodsServices = {
  variants: unknown;
  itemGoodsServicesCostCents: number;
};

/**
 * Unit goods/services (fulfillment COGS) in cents from the admin baseline catalog for a shop listing.
 * Non-baseline listings return 0.
 *
 * For **all variants** picks after Printify sync, `selectedVariantId` is usually a Printify variant id — pass
 * `productPrintifyVariantsJson` from the listing’s product so we can map Printify id → admin catalog variant id
 * (same rules as {@link remapShopListingCatalogVariantPricesAfterPrintifySync}).
 */
export function baselineGoodsServicesUnitCents(params: {
  baselineCatalogPickEncoded: string | null | undefined;
  /** Checkout line: Printify (or pre-sync catalog) variant id selected for the row. */
  selectedVariantId: string | null | undefined;
  catalogRow: BaselineCatalogRowForGoodsServices | null | undefined;
  /** From `Product.printifyVariants` — enables Printify↔catalog variant matching for `allVariants` mode. */
  productPrintifyVariantsJson?: unknown;
}): number {
  const pick = parseBaselinePick(params.baselineCatalogPickEncoded ?? "");
  if (!pick || !params.catalogRow) return 0;
  const row = params.catalogRow;
  const variants = parseAdminCatalogVariantsJson(row.variants);

  if (pick.mode === "item") {
    return Math.max(0, row.itemGoodsServicesCostCents);
  }
  if (pick.mode === "variant") {
    const v = variants.find((x) => x.id === pick.variantId);
    return Math.max(0, v?.goodsServicesCostCents ?? 0);
  }
  const vid = params.selectedVariantId?.trim();
  if (!vid) return 0;

  let catalogVar = variants.find((x) => x.id === vid);
  if (!catalogVar && pick.mode === "allVariants" && params.productPrintifyVariantsJson != null) {
    const pvs = parsePrintifyVariantsJson(params.productPrintifyVariantsJson);
    if (pvs.length > 0) {
      const idMap = buildPrintifyIdToCatalogVariantIdMap(
        variants.map((v) => ({ id: v.id, label: v.label })),
        pvs,
      );
      const catalogId = idMap.get(vid);
      if (catalogId) {
        catalogVar = variants.find((x) => x.id === catalogId);
      }
    }
  }
  return Math.max(0, catalogVar?.goodsServicesCostCents ?? 0);
}
