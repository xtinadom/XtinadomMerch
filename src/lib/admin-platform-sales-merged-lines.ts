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

/** Row filters: publication fee vs merchandise order lines. */
export type AdminPlatformSaleCategory = "listing" | "item" | "support";

export type AdminPlatformSalesMergedLine =
  | {
      kind: "merchandise";
      platformSaleCategory: "item";
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
      platformSaleCategory: "listing";
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
      kind: "support_tip";
      platformSaleCategory: "support";
      id: string;
      quantity: number;
      unitPriceCents: number;
      productName: string;
      goodsServicesCostCents: number;
      platformCutCents: number;
      shopCutCents: number;
      order: { id: string; createdAt: Date };
      shop: null;
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
  supportTipCount: number;
}> {
  const orderWhere = {
    order: {
      status: OrderStatus.paid,
      ...(opts.salesOrderCreatedAt ? { createdAt: opts.salesOrderCreatedAt } : {}),
    },
  };

  const listingFeePaidFilter = listingFeePaidAtWhere(opts.salesOrderCreatedAt);

  const supportTipWhere = opts.salesOrderCreatedAt ? { createdAt: opts.salesOrderCreatedAt } : {};

  const [orderLinesRaw, orderLineCount, feeListings, supportTips, supportTipCount] = await Promise.all([
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
    prisma.supportTip.findMany({
      where: supportTipWhere,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, amountCents: true, createdAt: true },
    }),
    prisma.supportTip.count({ where: supportTipWhere }),
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
    /** Free-slot waiver: do not show as a paid publication in platform sales. */
    if (row.listingPublicationFeePaidCents === 0) continue;
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
      platformSaleCategory: "listing",
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
    platformSaleCategory: "item" as const,
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

  const supportLines: AdminPlatformSalesMergedLine[] = supportTips.map((t) => ({
    kind: "support_tip" as const,
    platformSaleCategory: "support" as const,
    id: `support_tip:${t.id}`,
    quantity: 1,
    unitPriceCents: t.amountCents,
    productName: "Support tip",
    goodsServicesCostCents: 0,
    platformCutCents: t.amountCents,
    shopCutCents: 0,
    order: { id: `support_tip:${t.id}`, createdAt: t.createdAt },
    shop: null,
  }));

  const merged = [...merchLines, ...feeLines, ...supportLines].sort(
    (a, b) => b.order.createdAt.getTime() - a.order.createdAt.getTime(),
  );
  const lines = merged.slice(0, 500);

  return {
    lines,
    orderLineCount,
    publicationFeePaymentCount,
    supportTipCount,
  };
}

/** Jan 1 00:00:00.000 UTC of `year` through `end` (inclusive window for `lte`). */
export function utcYearToDateRange(year: number, end: Date): { gte: Date; lte: Date } {
  const gte = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  return { gte, lte: end };
}

export type PlatformSalesYtdTotals = {
  year: number;
  /** Sum of `OrderLine.platformCutCents` for paid orders in YTD window. */
  itemPlatformCents: number;
  /** Sum of publication fee platform revenue (same rules as merged listing fee rows). */
  listingPlatformCents: number;
  /** Sum of platform support tips (Stripe Checkout sessions). */
  supportPlatformCents: number;
};

/**
 * Year-to-date platform revenue by sale category (UTC calendar year through `through`).
 * Listing fees use the same waived / ordinal rules as {@link loadMergedPlatformSalesLines}.
 */
export async function loadPlatformSalesYtdTotals(
  prisma: PrismaClient,
  through: Date,
): Promise<PlatformSalesYtdTotals> {
  const year = through.getUTCFullYear();
  const { gte, lte } = utcYearToDateRange(year, through);

  const orderLineSum = await prisma.orderLine.aggregate({
    where: {
      order: {
        status: OrderStatus.paid,
        createdAt: { gte, lte },
      },
    },
    _sum: { platformCutCents: true },
  });

  const listingFeePaidFilter: Prisma.DateTimeNullableFilter = {
    not: null,
    gte,
    lte,
  };

  const feeListings = await prisma.shopListing.findMany({
    where: { listingFeePaidAt: listingFeePaidFilter },
    select: {
      id: true,
      shopId: true,
      listingFeePaidAt: true,
      listingPublicationFeePaidCents: true,
      shop: {
        select: {
          slug: true,
          listingFeeBonusFreeSlots: true,
        },
      },
    },
  });

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

  let listingPlatformCents = 0;
  for (const row of feeListings) {
    if (!row.listingFeePaidAt) continue;
    if (row.listingPublicationFeePaidCents === 0) continue;
    const feeCents = publicationFeeCentsForListing(
      {
        id: row.id,
        shopId: row.shopId,
        listingFeePaidAt: row.listingFeePaidAt,
        listingPublicationFeePaidCents: row.listingPublicationFeePaidCents,
        requestItemName: null,
        shop: {
          displayName: "",
          slug: row.shop.slug,
          listingFeeBonusFreeSlots: row.shop.listingFeeBonusFreeSlots ?? 0,
        },
      },
      ordinalByListingId,
    );
    if (feeCents > 0) listingPlatformCents += feeCents;
  }

  const supportTipSum = await prisma.supportTip.aggregate({
    where: { createdAt: { gte, lte } },
    _sum: { amountCents: true },
  });

  return {
    year,
    itemPlatformCents: orderLineSum._sum.platformCutCents ?? 0,
    listingPlatformCents,
    supportPlatformCents: supportTipSum._sum.amountCents ?? 0,
  };
}
