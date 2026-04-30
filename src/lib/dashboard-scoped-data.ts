import type { Prisma } from "@/generated/prisma/client";
import { ListingRequestStatus, OrderStatus, PromotionKind, PromotionPurchaseStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import { buildGroupedListingSectionsForDashboard } from "@/lib/dashboard-legacy-baseline-listing-groups";
import { sanitizeShopListingAdminSecondaryImageUrlForDisplay, sanitizeShopListingOwnerSupplementImageUrlForDisplay } from "@/lib/r2-upload";
import { ensureBaselineAdminCatalogIfEmpty } from "@/lib/seed-baseline-admin-catalog";
import { buildShopBaselineCatalogGroups } from "@/lib/shop-baseline-catalog";
import { listingRejectionReasonTextForCard, resolveListingRejectionNoticeBody } from "@/lib/shop-listing-rejection-notice";
import {
  resolveCatalogPrefillFromBaselinePickEncoded,
  resolveCatalogPrefillFromStubProductSlug,
  type DraftListingRequestPrefillPayload,
} from "@/lib/shop-baseline-draft-prefill";
import {
  resolveHotItemPlacementOfferWithCounts,
  resolvePopularPlacementOffer,
  resolveTopShopPlacementOfferWithCounts,
} from "@/lib/promotion-hot-item-policy";
import { HOT_ITEM_PLATFORM_PERIOD_CAP, TOP_SHOP_PLATFORM_PERIOD_CAP } from "@/lib/promotion-policy-shared";
import { currentListingPromotionPeriodStartUtc, formatPacificPromotionWindowMmDdRange } from "@/lib/promotion-period-pacific";
import { promotionPriceCentsForKind } from "@/lib/promotions";
import { countNewSupportMessagesFromStaff } from "@/lib/support-thread-new-from-staff";
import {
  type AdminCatalogRowForDisplay,
  listingGoodsServicesUnitCentsByPrintifyVariantId,
} from "@/lib/dashboard-payload-helpers";
import type { DashboardMainTabId } from "@/lib/dashboard-main-tab-id";
import type { ComponentProps } from "react";
import { ListingsPromotedSection } from "@/components/dashboard/ListingsPromotedSection";
import type { DashboardListingRow, DashboardPaidOrderRow, DashboardNoticeRow } from "@/components/dashboard/DashboardMainTabs";
import type { ShopSetupCatalogGroup } from "@/lib/shop-baseline-catalog";
import type { GroupedDashboardListing } from "@/lib/dashboard-legacy-baseline-listing-groups";
import {
  dashboardPaidOrderLineDisplayLabel,
  paidOrderLineGoodsServicesDisplayCents,
} from "@/lib/dashboard-payload-helpers";

export type DashboardScope =
  | "listingsBody"
  | "promotionsBody"
  | "ordersBody"
  | "notificationsBody"
  | "supportBody"
  | "requestListingCatalog";

export type DashboardPromotionsPayload = ComponentProps<typeof ListingsPromotedSection>;

type DashboardGroupedListingSections = {
  live: GroupedDashboardListing<DashboardListingRow>[];
  request: GroupedDashboardListing<DashboardListingRow>[];
  removed: GroupedDashboardListing<DashboardListingRow>[];
};

export type DashboardSupportChatPayload = {
  messages: { id: string; authorRole: "creator" | "admin"; body: string; createdAt: string }[];
  resolvedAtIso: string | null;
};

type ShopWithListings = Prisma.ShopGetPayload<{
  include: {
    listings: {
      orderBy: { updatedAt: "desc" };
      include: { product: true };
    };
  };
}>;

type OrderLineForDash = Prisma.OrderGetPayload<{
  select: {
    id: true;
    createdAt: true;
    lines: {
      select: {
        productName: true;
        quantity: true;
        unitPriceCents: true;
        goodsServicesCostCents: true;
        platformCutCents: true;
        shopCutCents: true;
        printifyVariantId: true;
        shopListing: { select: { baselineCatalogPickEncoded: true; requestItemName: true } };
        product: { select: { name: true; printifyVariants: true } };
      };
    };
  };
}>;

async function loadPromotionsPayloadForShop(
  shopId: string,
  liveListingPicklist: { id: string; label: string }[],
): Promise<DashboardPromotionsPayload> {
  const isDev = process.env.NODE_ENV === "development";
  const time = async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      if (isDev) {
        const ms = Date.now() - start;
        console.log(`[promotionsTiming] ${label}: ${ms}ms`);
      }
    }
  };

  const mockListingFeeCheckout = isMockCheckoutEnabled();
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;
  const hotItemBaseCents = promotionPriceCentsForKind(PromotionKind.HOT_FEATURED_ITEM);
  const topShopBaseCents = promotionPriceCentsForKind(PromotionKind.FEATURED_SHOP_HOME);
  const popularBaseCents = promotionPriceCentsForKind(PromotionKind.MOST_POPULAR_OF_TAG_ITEM);

  const promotionPurchasesForDash = await time("promotionPurchase.findMany", () =>
    prisma.promotionPurchase.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        shopListing: {
          select: { requestItemName: true, product: { select: { name: true } } },
        },
      },
    }),
  );

  const [hotOfferWithCounts, topShopOfferWithCounts, popularOfferResolved] = await time(
    "resolveOffers",
    () =>
      Promise.all([
        resolveHotItemPlacementOfferWithCounts(hotItemBaseCents),
        resolveTopShopPlacementOfferWithCounts(topShopBaseCents),
        resolvePopularPlacementOffer(popularBaseCents),
      ]),
  );

  const periodStartUtc = currentListingPromotionPeriodStartUtc(new Date());
  const hotPeriodIndex = hotOfferWithCounts.periodStarts.findIndex((d) => d.getTime() === periodStartUtc.getTime());
  const topPeriodIndex = topShopOfferWithCounts.periodStarts.findIndex((d) => d.getTime() === periodStartUtc.getTime());

  const hotSlotsUsedUtc =
    hotPeriodIndex >= 0 ? hotOfferWithCounts.filledCounts[hotPeriodIndex as 0 | 1 | 2] : 0;
  const topShopSlotsUsedUtc =
    topPeriodIndex >= 0 ? topShopOfferWithCounts.filledCounts[topPeriodIndex as 0 | 1 | 2] : 0;

  const hotOfferResolved = hotOfferWithCounts.offer;
  const topShopOfferResolved = topShopOfferWithCounts.offer;

  return {
    purchases: promotionPurchasesForDash.map((row) => {
      const activeWindowPacificRange =
        row.paidAt && row.status === PromotionPurchaseStatus.paid
          ? formatPacificPromotionWindowMmDdRange({
              eligibleFrom: row.eligibleFrom,
              paidAt: row.paidAt,
            })
          : null;
      return {
        id: row.id,
        kind: row.kind,
        status: row.status,
        amountCents: row.amountCents,
        createdAtIso: row.createdAt.toISOString(),
        paidAtIso: row.paidAt?.toISOString() ?? null,
        eligibleFromIso: row.eligibleFrom?.toISOString() ?? null,
        activeWindowPacificRange,
        listingLabel: row.shopListing
          ? row.shopListing.requestItemName?.trim() || row.shopListing.product.name
          : null,
      };
    }),
    liveListingPicklist,
    mockPromotionCheckout: mockListingFeeCheckout,
    stripePublishableKey,
    hotItemPromotion: {
      monthlyCap: HOT_ITEM_PLATFORM_PERIOD_CAP,
      slotsUsedUtcThisMonth: hotSlotsUsedUtc,
      offerError: hotOfferResolved && "error" in hotOfferResolved ? hotOfferResolved.error : null,
      offer:
        hotOfferResolved && !("error" in hotOfferResolved)
          ? {
              amountCents: hotOfferResolved.amountCents,
              eligibleFromIso: hotOfferResolved.eligibleFrom.toISOString(),
              isDeferred: hotOfferResolved.futurePeriodOffset > 0,
              isSecondFuturePeriod: hotOfferResolved.isSecondFuturePeriod,
              isProrated: hotOfferResolved.isProrated,
              placementMonthLabel: hotOfferResolved.placementPeriodLabel,
            }
          : null,
    },
    topShopPromotion: {
      monthlyCap: TOP_SHOP_PLATFORM_PERIOD_CAP,
      slotsUsedUtcThisMonth: topShopSlotsUsedUtc,
      offerError:
        topShopOfferResolved && "error" in topShopOfferResolved ? topShopOfferResolved.error : null,
      offer:
        topShopOfferResolved && !("error" in topShopOfferResolved)
          ? {
              amountCents: topShopOfferResolved.amountCents,
              eligibleFromIso: topShopOfferResolved.eligibleFrom.toISOString(),
              isDeferred: topShopOfferResolved.futurePeriodOffset > 0,
              isSecondFuturePeriod: topShopOfferResolved.isSecondFuturePeriod,
              isProrated: topShopOfferResolved.isProrated,
              placementMonthLabel: topShopOfferResolved.placementPeriodLabel,
            }
          : null,
    },
    popularItemPromotion: {
      offerError:
        popularOfferResolved && "error" in popularOfferResolved ? popularOfferResolved.error : null,
      offer:
        popularOfferResolved && !("error" in popularOfferResolved)
          ? {
              amountCents: popularOfferResolved.amountCents,
              eligibleFromIso: popularOfferResolved.eligibleFrom.toISOString(),
              isProrated: popularOfferResolved.isProrated,
              placementMonthLabel: popularOfferResolved.placementPeriodLabel,
            }
          : null,
    },
  };
}

/**
 * Initial RSC load: only fetch tab payloads for the active `?dash=` tab (plus lightweight badge counts).
 */
export function scopesForInitialTab(
  tab: DashboardMainTabId,
  isPlatform: boolean,
): DashboardScope[] {
  if (isPlatform) {
    return tab === "orders" ? ["ordersBody"] : ["listingsBody"];
  }
  switch (tab) {
    case "listings":
      return ["listingsBody"];
    case "promotions":
      return ["promotionsBody"];
    case "orders":
      return ["ordersBody"];
    case "notifications":
      return ["notificationsBody"];
    case "support":
      return ["supportBody"];
    case "requestListing":
      return ["requestListingCatalog"];
    case "setup":
    case "shopProfile":
    case "itemGuidelines":
    case "bugFeedback":
      return [];
    default:
      return ["listingsBody"];
  }
}

export async function loadBadgeCounts(shopId: string, isPlatform: boolean) {
  if (isPlatform) {
    return { notificationsUnread: 0, supportNewFromStaff: 0 };
  }
  const [notificationsUnread, supportThread] = await Promise.all([
    prisma.shopOwnerNotice.count({ where: { shopId, readAt: null } }),
    prisma.supportThread.findUnique({
      where: { shopId },
      select: {
        messages: { select: { authorRole: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  const supportNewFromStaffCount =
    supportThread?.messages?.length && supportThread.messages.length > 0
      ? countNewSupportMessagesFromStaff(supportThread.messages)
      : 0;
  return { notificationsUnread, supportNewFromStaff: supportNewFromStaffCount };
}

export async function loadDashboardScopedChunks(
  shopId: string,
  isPlatform: boolean,
  scopes: DashboardScope[],
): Promise<{
  listingRows: DashboardListingRow[];
  groupedListingSections: DashboardGroupedListingSections;
  promotionsPayload: DashboardPromotionsPayload | null;
  paidOrders: DashboardPaidOrderRow[];
  notifications: { rows: DashboardNoticeRow[]; unreadCount: number } | null;
  supportChat: DashboardSupportChatPayload | null;
  requestListingCatalog: {
    catalogGroups: ShopSetupCatalogGroup[];
    draftListingRequestPrefill: DraftListingRequestPrefillPayload | null;
    adminCatalogItemCount: number;
  } | null;
}> {
  const scopeSet = new Set(scopes);
  const needBaseline = scopeSet.has("listingsBody") || scopeSet.has("requestListingCatalog");
  if (needBaseline) {
    await ensureBaselineAdminCatalogIfEmpty(prisma);
  }

  const emptyGroups: DashboardGroupedListingSections = { live: [], request: [], removed: [] };

  const defaults = {
    listingRows: [] as DashboardListingRow[],
    groupedListingSections: emptyGroups,
    promotionsPayload: null as DashboardPromotionsPayload | null,
    paidOrders: [] as DashboardPaidOrderRow[],
    notifications: null as { rows: DashboardNoticeRow[]; unreadCount: number } | null,
    supportChat: null as DashboardSupportChatPayload | null,
    requestListingCatalog: null as {
      catalogGroups: ShopSetupCatalogGroup[];
      draftListingRequestPrefill: DraftListingRequestPrefillPayload | null;
      adminCatalogItemCount: number;
    } | null,
  };

  if (isPlatform && !scopeSet.has("listingsBody") && !scopeSet.has("ordersBody")) {
    return defaults;
  }

  const adminCatalogSelect = {
    id: true,
    name: true,
    itemExampleListingUrl: true,
    itemMinPriceCents: true,
    itemGoodsServicesCostCents: true,
    itemImageRequirementLabel: true,
    itemPrintAreaWidthPx: true,
    itemPrintAreaHeightPx: true,
    itemMinArtworkDpi: true,
  } as const;

  let adminCatalogRows: Awaited<
    ReturnType<typeof prisma.adminCatalogItem.findMany<{ select: typeof adminCatalogSelect }>>
  > = [];

  if (!isPlatform && (scopeSet.has("listingsBody") || scopeSet.has("requestListingCatalog"))) {
    adminCatalogRows = await prisma.adminCatalogItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: adminCatalogSelect,
    });
  }

  const adminCatalogById = new Map<string, AdminCatalogRowForDisplay>(
    adminCatalogRows.map((r) => [r.id, { itemGoodsServicesCostCents: r.itemGoodsServicesCostCents }]),
  );

  let allOwnerNotices: Awaited<ReturnType<typeof prisma.shopOwnerNotice.findMany>> = [];
  if (!isPlatform && scopeSet.has("listingsBody")) {
    allOwnerNotices = await prisma.shopOwnerNotice.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        shopId: true,
        id: true,
        body: true,
        kind: true,
        createdAt: true,
        readAt: true,
        relatedListingId: true,
      },
    });
  }

  let shopFull: ShopWithListings | null = null;
  if (scopeSet.has("listingsBody")) {
    shopFull = await prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      include: {
        listings: {
          orderBy: { updatedAt: "desc" },
          include: { product: true },
        },
      },
    });
  }

  let listingRows: DashboardListingRow[] = [];
  let groupedListingSections: DashboardGroupedListingSections = emptyGroups;
  let promotionsPayload: DashboardPromotionsPayload | null = null;

  if (shopFull && scopeSet.has("listingsBody")) {
    const listingOrdinalById = (() => {
      const ordered = [...shopFull.listings].sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
      );
      return new Map(ordered.map((l, i) => [l.id, i + 1]));
    })();

    listingRows = shopFull.listings.map((listing) => {
      const rejectionNoticeBody =
        listing.requestStatus === ListingRequestStatus.rejected && !isPlatform
          ? resolveListingRejectionNoticeBody(
              allOwnerNotices,
              listing.id,
              listing.product.name,
            )
          : null;
      const rejectionReasonText = listingRejectionReasonTextForCard(rejectionNoticeBody);
      return {
        id: listing.id,
        active: listing.active,
        requestStatus: listing.requestStatus,
        priceCents: listing.priceCents,
        requestImages: listing.requestImages,
        adminListingSecondaryImageUrl: sanitizeShopListingAdminSecondaryImageUrlForDisplay(
          listing.adminListingSecondaryImageUrl,
          shopFull!.id,
          listing.id,
        ),
        ownerSupplementImageUrl: sanitizeShopListingOwnerSupplementImageUrlForDisplay(
          listing.ownerSupplementImageUrl,
          shopFull!.id,
          listing.id,
        ),
        listingStorefrontCatalogImageUrls: listing.listingStorefrontCatalogImageUrls,
        baselineCatalogPickEncoded: listing.baselineCatalogPickEncoded,
        goodsServicesUnitCentsByPrintifyVariantId: listingGoodsServicesUnitCentsByPrintifyVariantId(
          {
            baselineCatalogPickEncoded: listing.baselineCatalogPickEncoded,
            product: listing.product,
          },
          adminCatalogById,
        ),
        listingPrintifyVariantId: listing.listingPrintifyVariantId,
        listingPrintifyVariantPrices: listing.listingPrintifyVariantPrices,
        requestItemName: listing.requestItemName,
        storefrontItemBlurb: listing.storefrontItemBlurb,
        listingSearchKeywords: listing.listingSearchKeywords,
        listingFeePaidAt: listing.listingFeePaidAt?.toISOString() ?? null,
        adminRemovedFromShopAt: listing.adminRemovedFromShopAt?.toISOString() ?? null,
        creatorRemovedFromShopAt: listing.creatorRemovedFromShopAt?.toISOString() ?? null,
        listingOrdinal: listingOrdinalById.get(listing.id) ?? 1,
        updatedAtIso: listing.updatedAt.toISOString(),
        rejectionReasonText,
        product: {
          name: listing.product.name,
          slug: listing.product.slug,
          active: listing.product.active,
          minPriceCents: listing.product.minPriceCents,
          priceCents: listing.product.priceCents,
          imageUrl: listing.product.imageUrl,
          imageGallery: listing.product.imageGallery,
          fulfillmentType: listing.product.fulfillmentType,
          printifyVariantId: listing.product.printifyVariantId,
          printifyVariants: listing.product.printifyVariants,
        },
      };
    });

    groupedListingSections = buildGroupedListingSectionsForDashboard(
      shopFull.id,
      listingRows,
      adminCatalogRows,
    );
  }

  if (!isPlatform && scopeSet.has("promotionsBody")) {
    let livePicklist: { id: string; label: string }[];
    if (listingRows.length > 0) {
      livePicklist = listingRows
        .filter((l) => l.active && l.requestStatus !== ListingRequestStatus.rejected)
        .map((l) => ({
          id: l.id,
          label: (l.requestItemName && l.requestItemName.trim()) || l.product.name,
        }));
    } else {
      const minimal = await prisma.shopListing.findMany({
        where: { shopId },
        select: {
          id: true,
          active: true,
          requestStatus: true,
          requestItemName: true,
          product: { select: { name: true } },
        },
      });
      livePicklist = minimal
        .filter((l) => l.active && l.requestStatus !== ListingRequestStatus.rejected)
        .map((l) => ({
          id: l.id,
          label: (l.requestItemName && l.requestItemName.trim()) || l.product.name,
        }));
    }
    promotionsPayload = await loadPromotionsPayloadForShop(shopId, livePicklist);
  }

  let paidOrders: DashboardPaidOrderRow[] = [];
  if (scopeSet.has("ordersBody")) {
    const orders = await prisma.order.findMany({
      where: { shopId, status: OrderStatus.paid },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        lines: {
          select: {
            productName: true,
            quantity: true,
            unitPriceCents: true,
            goodsServicesCostCents: true,
            platformCutCents: true,
            shopCutCents: true,
            printifyVariantId: true,
            shopListing: {
              select: { baselineCatalogPickEncoded: true, requestItemName: true },
            },
            product: {
              select: { name: true, printifyVariants: true },
            },
          },
        },
      },
    });

    const ordersAdminCatalog =
      adminCatalogRows.length > 0
        ? adminCatalogRows
        : await prisma.adminCatalogItem.findMany({
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: adminCatalogSelect,
          });
    const ordersAdminById = new Map<string, AdminCatalogRowForDisplay>(
      ordersAdminCatalog.map((r) => [r.id, { itemGoodsServicesCostCents: r.itemGoodsServicesCostCents }]),
    );

    paidOrders = orders.map((o: OrderLineForDash) => ({
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      lines: o.lines.map((l) => ({
        lineDisplayLabel: dashboardPaidOrderLineDisplayLabel(l),
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        goodsServicesCostCents: paidOrderLineGoodsServicesDisplayCents(l, ordersAdminById),
        platformCutCents: l.platformCutCents,
        shopCutCents: l.shopCutCents,
      })),
    }));
  }

  let notifications: { rows: DashboardNoticeRow[]; unreadCount: number } | null = null;
  if (!isPlatform && scopeSet.has("notificationsBody")) {
    const rows = await prisma.shopOwnerNotice.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        body: true,
        kind: true,
        createdAt: true,
        readAt: true,
        relatedListingId: true,
      },
    });
    const unreadCount = rows.filter((n) => n.readAt == null).length;
    notifications = {
      rows: rows.map((n) => ({
        id: n.id,
        body: n.body,
        kind: n.kind,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
      })),
      unreadCount,
    };
  }

  let supportChat: DashboardSupportChatPayload | null = null;
  if (!isPlatform && scopeSet.has("supportBody")) {
    const supportThreadForPanel = await prisma.supportThread.findUnique({
      where: { shopId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    supportChat = {
      messages:
        supportThreadForPanel?.messages.map((m) => ({
          id: m.id,
          authorRole: m.authorRole as "creator" | "admin",
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })) ?? [],
      resolvedAtIso: supportThreadForPanel?.resolvedAt?.toISOString() ?? null,
    };
  }

  let requestListingCatalog: {
    catalogGroups: ShopSetupCatalogGroup[];
    draftListingRequestPrefill: DraftListingRequestPrefillPayload | null;
    adminCatalogItemCount: number;
  } | null = null;

  if (!isPlatform && scopeSet.has("requestListingCatalog")) {
    const rows =
      adminCatalogRows.length > 0
        ? adminCatalogRows
        : await prisma.adminCatalogItem.findMany({
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: adminCatalogSelect,
          });
    const catalogGroups = buildShopBaselineCatalogGroups(rows);

    const draftListingForRequestPrefill = await prisma.shopListing.findFirst({
      where: {
        shopId,
        requestStatus: ListingRequestStatus.draft,
        active: false,
        creatorRemovedFromShopAt: null,
        adminRemovedFromShopAt: null,
      },
      include: { product: true },
    });

    let draftListingRequestPrefill: DraftListingRequestPrefillPayload | null = null;
    if (draftListingForRequestPrefill && rows.length > 0) {
      const encoded = draftListingForRequestPrefill.baselineCatalogPickEncoded?.trim();
      const fromEncoded = encoded
        ? resolveCatalogPrefillFromBaselinePickEncoded(
            encoded,
            draftListingForRequestPrefill.priceCents,
            draftListingForRequestPrefill.requestItemName,
            rows,
          )
        : null;
      const resolved =
        fromEncoded ??
        resolveCatalogPrefillFromStubProductSlug(
          shopId,
          draftListingForRequestPrefill.product.slug,
          draftListingForRequestPrefill.priceCents,
          draftListingForRequestPrefill.requestItemName,
          rows,
        );
      if (resolved) {
        draftListingRequestPrefill = {
          listingId: draftListingForRequestPrefill.id,
          ...resolved,
          storefrontItemBlurb: draftListingForRequestPrefill.storefrontItemBlurb,
          listingSearchKeywords: draftListingForRequestPrefill.listingSearchKeywords,
        };
      }
    }

    requestListingCatalog = {
      catalogGroups,
      draftListingRequestPrefill,
      adminCatalogItemCount: rows.length,
    };
  }

  return {
    listingRows,
    groupedListingSections,
    promotionsPayload,
    paidOrders,
    notifications,
    supportChat,
    requestListingCatalog,
  };
}
