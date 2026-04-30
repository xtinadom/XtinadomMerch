import type { Prisma } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import { baselineGoodsServicesUnitCents } from "@/lib/baseline-goods-services-unit-cents";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";

export type AdminCatalogRowForDisplay = {
  itemGoodsServicesCostCents: number;
};

export function formatMoneyServer(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Orders tab: shop listing title, then admin catalog product name in parentheses. */
export function dashboardPaidOrderLineDisplayLabel(line: {
  productName: string;
  product: { name: string } | null;
  shopListing: { requestItemName: string | null } | null;
}): string {
  const adminLabel = (line.product?.name ?? line.productName).trim() || line.productName;
  const shopLabel = line.shopListing?.requestItemName?.trim() ?? "";
  if (!shopLabel || shopLabel === adminLabel) {
    return adminLabel;
  }
  return `${shopLabel} (${adminLabel})`;
}

/** Uses current admin baseline catalog + listing pick + Printify variant mapping (same as checkout). */
export function paidOrderLineGoodsServicesDisplayCents(
  line: {
    unitPriceCents: number;
    quantity: number;
    goodsServicesCostCents: number;
    printifyVariantId: string | null;
    shopListing: { baselineCatalogPickEncoded: string | null } | null;
    product: { printifyVariants: unknown } | null;
  },
  adminCatalogById: Map<string, AdminCatalogRowForDisplay>,
): number {
  const pick = parseBaselinePick(line.shopListing?.baselineCatalogPickEncoded ?? "");
  if (!pick) return line.goodsServicesCostCents;
  const row = adminCatalogById.get(pick.itemId);
  if (!row) return line.goodsServicesCostCents;
  const unit = baselineGoodsServicesUnitCents({
    baselineCatalogPickEncoded: line.shopListing?.baselineCatalogPickEncoded,
    selectedVariantId: line.printifyVariantId,
    catalogRow: row,
    productPrintifyVariantsJson: line.product?.printifyVariants,
  });
  const merch = line.unitPriceCents * line.quantity;
  return Math.min(merch, Math.max(0, unit) * line.quantity);
}

/** Per Printify variant id — unit COGS for profit estimates (same rules as checkout). */
export function listingGoodsServicesUnitCentsByPrintifyVariantId(
  listing: {
    baselineCatalogPickEncoded: string | null;
    product: {
      fulfillmentType: FulfillmentType;
      printifyVariants: Prisma.JsonValue | null;
      printifyVariantId: string | null;
      priceCents: number;
    };
  },
  adminCatalogById: Map<string, AdminCatalogRowForDisplay>,
): Record<string, number> {
  const pick = parseBaselinePick(listing.baselineCatalogPickEncoded ?? "");
  const row = pick ? adminCatalogById.get(pick.itemId) : undefined;
  const variants = getPrintifyVariantsForProduct(listing.product);
  const out: Record<string, number> = {};
  for (const v of variants) {
    const unit =
      row != null
        ? baselineGoodsServicesUnitCents({
            baselineCatalogPickEncoded: listing.baselineCatalogPickEncoded,
            selectedVariantId: v.id,
            catalogRow: row,
            productPrintifyVariantsJson: listing.product.printifyVariants,
          })
        : 0;
    out[v.id] = unit;
  }
  return out;
}
