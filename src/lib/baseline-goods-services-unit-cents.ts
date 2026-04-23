import { parseBaselinePick } from "@/lib/shop-baseline-catalog";

export type BaselineCatalogRowForGoodsServices = {
  itemGoodsServicesCostCents: number;
};

/**
 * Unit goods/services (fulfillment COGS) in cents from the admin baseline catalog for a shop listing.
 * Non-baseline listings return 0. Baseline catalog is item-level only; legacy pick encodings still resolve here.
 */
export function baselineGoodsServicesUnitCents(params: {
  baselineCatalogPickEncoded: string | null | undefined;
  /** @deprecated Ignored — kept for call-site compatibility. */
  selectedVariantId?: string | null | undefined;
  catalogRow: BaselineCatalogRowForGoodsServices | null | undefined;
  /** @deprecated Ignored — kept for call-site compatibility. */
  productPrintifyVariantsJson?: unknown;
}): number {
  const pick = parseBaselinePick(params.baselineCatalogPickEncoded ?? "");
  if (!pick || !params.catalogRow) return 0;
  return Math.max(0, params.catalogRow.itemGoodsServicesCostCents);
}
