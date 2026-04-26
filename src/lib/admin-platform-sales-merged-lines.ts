import type { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import { listingFeeCentsForOrdinal } from "@/lib/marketplace-constants";

const orderLineInclude = {
  order: { select: { id: true, createdAt: true } },
  shop: { select: { displayName: true, slug: true } },
  shopListing: { select: { requestItemName: true } },
} as const;

function orderLineDisplayName(l: AdminPlatformSalesOrderLineRow): string {
  const item = l.shopListing?.requestItemName?.trim();
  if (item) return item;
  return l.productName;
}

export type AdminPlatformSalesOrderLineRow = Prisma.OrderLineGetPayload<{
  include: typeof orderLineInclude;
}>;

export type AdminPlatformSalesMergedLine =
  | {
      kind: "merchandise";
      id: string;
      quantity: number;
      unitPriceCents: number;
      productName: string;
      goodsServicesCostCents: number;
      platformCutCents: number;
      shopCutCents: number;
      order: { id: string; createdAt: Date };
      shop: { displayName: string; slug: string } | null;
    }
  | {
      kind: "listing_publication_fee";
      id: string;
      quantity: number;
      unitPriceCents: number;
      productName: string;
      goodsServicesCostCents: number;
      platformCutCents: number;
      shopCutCents: number;
      order: { id: string; createdAt: Date };
      shop: { displayName: string; slug: string } | null;
    };

type ListingFeeRow = {
  id: string;
  shopId: string;
  listingFeePaidAt: Date;
  listingPublicationFeePaidCents: number | null;
  requestItemName: string | null;
  shop: { displayName: string; slug: string; listingFeeBonusFreeSlots: number };
};

function listingFeePaidAtWhere(
  salesOrderCreatedAt: { gte?: Date; lte?: Date } | undefined,
): Prisma.DateTimeNullableFilter {
  const notNull: Prisma.DateTimeNullableFilter = { not: null };
  if (!salesOrderCreatedAt) return notNull;
  return {
    not: null,
    ...(salesOrderCreatedAt.gte ? { gte: salesOrderCreatedAt.gte } : {}),
    ...(salesOrderCreatedAt.lte ? { lte: salesOrderCreatedAt.lte } : {}),
  };
}

function buildOrdinalByListingId(
  rows: { id: string; shopId: string }[],
): Map<string, number> {
  const map = new Map<string, number>();
  let curShop: string | null = null;
  let idx = 0;
  for (const r of rows) {
    if (r.shopId !== curShop) {
      curShop = r.shopId;
      idx = 0;
    }
    idx++;
    map.set(r.id, idx);
  }
  return map;
}

function publicationFeeCentsForListing(
  row: ListingFeeRow,
  ordinalByListingId: Map<string, number>,
): number {
  if (row.listingPublicationFeePaidCents != null) {
    return row.listingPublicationFeePaidCents;
  }
  const ordinal = ordinalByListingId.get(row.id) ?? 1;
  return listingFeeCentsForOrdinal(
    ordinal,
    row.shop.slug,
    Math.max(0, row.shop.listingFeeBonusFreeSlots),
  );
}

/**
 * Paid merchandise order lines plus listing publication fee payments (Stripe / mock), for the admin
 * Platform sales tab. Merged newest-first (cap 500 rows).
 */
export async function loadMergedPlatformSalesLines(
  prisma: PrismaClient,
  opts: { salesOrderCreatedAt?: { gte?: Date; lte?: Date } },
): Promise<{
  lines: AdminPlatformSalesMergedLine[];
  orderLineCount: number;
  publicationFeePaymentCount: number;
}> {
  const orderWhere = {
    order: {
      status: OrderStatus.paid,
      ...(opts.salesOrderCreatedAt ? { createdAt: opts.salesOrderCreatedAt } : {}),
    },
  };

  const listingFeePaidFilter = listingFeePaidAtWhere(opts.salesOrderCreatedAt);

  const [orderLinesRaw, orderLineCount, feeListings] = await Promise.all([
    prisma.orderLine.findMany({
      where: orderWhere,
      orderBy: { order: { createdAt: "desc" } },
      take: 500,
      include: orderLineInclude,
    }),
    prisma.orderLine.count({ where: orderWhere }),
    prisma.shopListing.findMany({
      where: { listingFeePaidAt: listingFeePaidFilter },
      select: {
        id: true,
        shopId: true,
        listingFeePaidAt: true,
        listingPublicationFeePaidCents: true,
        requestItemName: true,
        shop: {
          select: {
            displayName: true,
            slug: true,
            listingFeeBonusFreeSlots: true,
          },
        },
      },
    }),
  ]);

  const orderLines = orderLinesRaw as AdminPlatformSalesOrderLineRow[];

  const shopIds = [...new Set(feeListings.map((l) => l.shopId))];
  const ordinalRows =
    shopIds.length === 0
      ? []
      : await prisma.shopListing.findMany({
          where: { shopId: { in: shopIds } },
          orderBy: [{ shopId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: { id: true, shopId: true },
        });
  const ordinalByListingId = buildOrdinalByListingId(ordinalRows);

  const feeLines: AdminPlatformSalesMergedLine[] = [];
  let publicationFeePaymentCount = 0;
  for (const row of feeListings) {
    if (!row.listingFeePaidAt) continue;
    const feeCents = publicationFeeCentsForListing(
      {
        ...row,
        listingFeePaidAt: row.listingFeePaidAt,
        shop: {
          displayName: row.shop.displayName,
          slug: row.shop.slug,
          listingFeeBonusFreeSlots: row.shop.listingFeeBonusFreeSlots ?? 0,
        },
      },
      ordinalByListingId,
    );
    if (feeCents <= 0) continue;
    publicationFeePaymentCount++;
    const label = row.requestItemName?.trim()
      ? `Listing publication fee — ${row.requestItemName.trim()}`
      : "Listing publication fee";
    feeLines.push({
      kind: "listing_publication_fee",
      id: `listing_publication_fee:${row.id}`,
      quantity: 1,
      unitPriceCents: feeCents,
      productName: label,
      goodsServicesCostCents: 0,
      platformCutCents: feeCents,
      shopCutCents: 0,
      order: {
        id: `listing_publication_fee:${row.id}`,
        createdAt: row.listingFeePaidAt,
      },
      shop: {
        displayName: row.shop.displayName,
        slug: row.shop.slug,
      },
    });
  }

  const merchLines: AdminPlatformSalesMergedLine[] = orderLines.map((l) => ({
    kind: "merchandise" as const,
    id: l.id,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    productName: orderLineDisplayName(l),
    goodsServicesCostCents: l.goodsServicesCostCents,
    platformCutCents: l.platformCutCents,
    shopCutCents: l.shopCutCents,
    order: { id: l.order.id, createdAt: l.order.createdAt },
    shop: l.shop,
  }));

  const merged = [...merchLines, ...feeLines].sort(
    (a, b) => b.order.createdAt.getTime() - a.order.createdAt.getTime(),
  );
  const lines = merged.slice(0, 500);

  return {
    lines,
    orderLineCount,
    publicationFeePaymentCount,
  };
}
