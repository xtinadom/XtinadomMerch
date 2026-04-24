import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma, prismaAdminInboundEmailOrNull } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { logoutAdmin, updateProductDetails } from "@/actions/admin";
import {
  adminCreateTagForm,
  adminDeleteTagForm,
  adminUpdateTagForm,
} from "@/actions/admin-tags";
import { Prisma } from "@/generated/prisma/client";
import { ListingRequestStatus, OrderStatus } from "@/generated/prisma/enums";
import { productImageUrls } from "@/lib/product-media";
import { isR2UploadConfigured } from "@/lib/r2-upload";
import { ConfirmDeleteForm } from "@/components/ConfirmDeleteForm";
import { ProductDesignNameFields } from "@/components/admin/ProductDesignNameFields";
import { ProductTagFields } from "@/components/admin/ProductTagFields";
import { productHasTag, productTagIds } from "@/lib/product-tags";
import { emailLinkOrigin, publicAppBaseUrl } from "@/lib/public-app-url";
import { buildAdminEmailFormatEntries } from "@/lib/site-email-template-service";
import {
  ADMIN_BACKEND_BASE_PATH,
  ADMIN_MAIN_BASE_PATH,
} from "@/lib/admin-dashboard-urls";
import { PrintifyApiTab } from "./printify-api-tab";
import { PrintifyInventoryTab } from "./printify-inventory-tab";
import { SaveListingForm } from "@/components/admin/SaveListingForm";
import {
  collectKnownDesignNamesFromProducts,
  designNamesFromJson,
} from "@/lib/product-design-names";
import { AdminPlatformSalesTab } from "@/components/admin/AdminPlatformSalesTab";
import {
  loadMergedPlatformSalesLines,
  type AdminPlatformSalesMergedLine,
} from "@/lib/admin-platform-sales-merged-lines";
import {
  AdminShopLeaderboardTab,
  type AdminShopLeaderboardRow,
} from "@/components/admin/AdminShopLeaderboardTab";
import { AdminListingRequestsTab } from "@/components/admin/AdminListingRequestsTab";
import {
  AdminRemovedListingItemsTab,
  type RemovedListingRow,
} from "@/components/admin/AdminRemovedListingItemsTab";
import {
  AdminShopWatchTab,
  type ShopWatchDetail,
  type ShopWatchRow,
} from "@/components/admin/AdminShopWatchTab";
import { AdminShopHomeTopTab, type AdminShopHomeTopRow } from "@/components/admin/AdminShopHomeTopTab";
import {
  listingRejectionReasonTextForCard,
  resolveListingRejectionNoticeBody,
} from "@/lib/shop-listing-rejection-notice";
import { AdminListTab } from "@/components/admin/AdminListTab";
import {
  AdminSupportMessagesTab,
  type AdminSupportThreadDetail,
  type AdminSupportThreadListRow,
} from "@/components/admin/AdminSupportMessagesTab";
import { AdminEmailFormatTab } from "@/components/admin/AdminEmailFormatTab";
import { AdminInboxTab, type AdminInboxRow } from "@/components/admin/AdminInboxTab";
import {
  isFounderUnlimitedFreeListingsShop,
  listingFeeCentsForOrdinal,
  PLATFORM_SHOP_SLUG,
  SPECIAL_PROMOTION_FREE_LISTING_IDS,
} from "@/lib/marketplace-constants";
import { adminInboxEmailAddress } from "@/lib/admin-inbox-config";
import { ensureBaselineAdminCatalogIfEmpty } from "@/lib/seed-baseline-admin-catalog";
import { supportUnresolvedThreadShopIdsExcludingPlatform } from "@/lib/support-thread-unresolved";
import { fetchPrintifyCatalog, hasPrintifyApiToken } from "@/lib/printify";
import { defaultPrintifyVariantIdForCatalogProduct } from "@/lib/printify-catalog";
import {
  formatBytesForAdmin,
  getAdminDeployFootprint,
  type AdminDeployFootprint,
} from "@/lib/deploy-footprint";
import { listingRejectionNoticeDetail } from "@/lib/listing-request-reject-reasons";
export const dynamic = "force-dynamic";

function priceInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

type AdminProductWithTags = Prisma.ProductGetPayload<{
  include: { primaryTag: true; tags: { include: { tag: true } } };
}>;

type AdminListingRequestShopListing = Prisma.ShopListingGetPayload<{
  include: {
    shop: true;
    product: {
      select: {
        id: true;
        name: true;
        slug: true;
        fulfillmentType: true;
        imageUrl: true;
        imageGallery: true;
      };
    };
  };
}>;

type AdminRemovedShopListingLoaded = Prisma.ShopListingGetPayload<{
  include: {
    shop: true;
    product: {
      select: {
        id: true;
        name: true;
        slug: true;
        fulfillmentType: true;
        imageUrl: true;
        imageGallery: true;
      };
    };
  };
}>;

export type AdminDashboardSection = "main" | "backend";

type AdminDashboardProps = {
  adminSection: AdminDashboardSection;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function AdminDashboardPageContent({
  adminSection,
  searchParams,
}: AdminDashboardProps) {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) {
    redirect("/admin/login");
  }

  try {
    await ensureBaselineAdminCatalogIfEmpty(prisma);
  } catch (e) {
    console.error("[admin] ensureBaselineAdminCatalogIfEmpty failed", e);
  }

  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const supportShopParam =
    typeof sp.supportShop === "string" && sp.supportShop.trim() ? sp.supportShop.trim() : undefined;
  const watchShopParam =
    typeof sp.watchShop === "string" && sp.watchShop.trim() ? sp.watchShop.trim() : undefined;

  const mainTabLiterals = [
    "support",
    "admin-inbox",
    "requests",
    "shop-watch",
    "shop-leaderboard",
    "home-top-shops",
    "sales",
  ] as const;
  const backendTabLiterals = [
    "admin-list",
    "printify",
    "removed",
    "email-format",
    "tags",
    "printify-api",
  ] as const;

  if (
    adminSection === "main" &&
    tabParam &&
    (backendTabLiterals as readonly string[]).includes(tabParam)
  ) {
    const q = new URLSearchParams();
    for (const [key, raw] of Object.entries(sp)) {
      if (typeof raw === "string" && raw) q.set(key, raw);
      else if (Array.isArray(raw)) {
        const first = raw.find((x) => typeof x === "string" && x);
        if (typeof first === "string") q.set(key, first);
      }
    }
    redirect(`${ADMIN_BACKEND_BASE_PATH}?${q.toString()}`);
  }

  if (
    adminSection === "backend" &&
    tabParam &&
    (mainTabLiterals as readonly string[]).includes(tabParam)
  ) {
    const q = new URLSearchParams();
    for (const [key, raw] of Object.entries(sp)) {
      if (typeof raw === "string" && raw) q.set(key, raw);
      else if (Array.isArray(raw)) {
        const first = raw.find((x) => typeof x === "string" && x);
        if (typeof first === "string") q.set(key, first);
      }
    }
    redirect(`${ADMIN_MAIN_BASE_PATH}?${q.toString()}`);
  }

  if (adminSection === "backend" && tabParam === "orders") {
    const q = new URLSearchParams();
    for (const [key, raw] of Object.entries(sp)) {
      if (key === "tab") continue;
      if (typeof raw === "string" && raw) q.set(key, raw);
      else if (Array.isArray(raw)) {
        const first = raw.find((x) => typeof x === "string" && x);
        if (typeof first === "string") q.set(key, first);
      }
    }
    const qs = q.toString();
    redirect(`${ADMIN_BACKEND_BASE_PATH}${qs ? `?${qs}` : ""}`);
  }

  type InventoryTab =
    | (typeof mainTabLiterals)[number]
    | (typeof backendTabLiterals)[number];

  const inventoryTabLiterals =
    adminSection === "main" ? mainTabLiterals : backendTabLiterals;
  const defaultInventoryTab: InventoryTab =
    adminSection === "main" ? "support" : "admin-list";
  const inventoryTab: InventoryTab =
    tabParam != null && (inventoryTabLiterals as readonly string[]).includes(tabParam)
      ? (tabParam as InventoryTab)
      : defaultInventoryTab;

  const basePath =
    adminSection === "main" ? ADMIN_MAIN_BASE_PATH : ADMIN_BACKEND_BASE_PATH;

  const publicBaseTrim = publicAppBaseUrl()?.replace(/\/$/, "") ?? "";
  const adminInboxWebhookEndpoint = publicBaseTrim
    ? `${publicBaseTrim}/api/webhooks/resend-inbound`
    : null;

  const siteEmailTemplateRows =
    adminSection === "backend" && inventoryTab === "email-format"
      ? await prisma.siteEmailTemplate.findMany({
          where: {
            key: {
              in: [
                "shop_dashboard_email_verification",
                "shop_dashboard_password_reset",
                "shop_dashboard_account_deletion_confirm",
                "merch_quote_contact_inquiry",
              ],
            },
          },
        })
      : [];

  const emailFormatTabEntries =
    adminSection === "backend" && inventoryTab === "email-format"
      ? buildAdminEmailFormatEntries(siteEmailTemplateRows, emailLinkOrigin())
      : [];

  const adminInboundDelegate = prismaAdminInboundEmailOrNull();
  const adminInboxCount =
    adminSection === "main" && adminInboundDelegate
      ? await adminInboundDelegate.count()
      : 0;

  const adminInboxRowsLoaded: AdminInboxRow[] =
    adminSection === "main" && inventoryTab === "admin-inbox" && adminInboundDelegate
      ? (
          await adminInboundDelegate.findMany({
            orderBy: { receivedAt: "desc" },
            take: 200,
          })
        ).map((r) => ({
          id: r.id,
          resendEmailId: r.resendEmailId,
          fromAddress: r.fromAddress,
          toAddress: r.toAddress,
          subject: r.subject,
          textBody: r.textBody,
          htmlBody: r.htmlBody,
          receivedAt: r.receivedAt.toISOString(),
        }))
      : [];

  const salesFromRaw = typeof sp.salesFrom === "string" ? sp.salesFrom : "";
  const salesToRaw = typeof sp.salesTo === "string" ? sp.salesTo : "";
  function parseIsoDateBoundary(s: string): Date | undefined {
    const t = s.trim();
    if (!t) return undefined;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const salesFrom = parseIsoDateBoundary(salesFromRaw);
  const salesTo = parseIsoDateBoundary(salesToRaw);
  const salesOrderCreatedAt =
    salesFrom || salesTo
      ? {
          ...(salesFrom ? { gte: salesFrom } : {}),
          ...(salesTo ? { lte: salesTo } : {}),
        }
      : undefined;
  const leaderboardOrderDateSql: Prisma.Sql =
    salesFrom && salesTo
      ? Prisma.sql`AND o."createdAt" >= ${salesFrom} AND o."createdAt" <= ${salesTo}`
      : salesFrom
        ? Prisma.sql`AND o."createdAt" >= ${salesFrom}`
        : salesTo
          ? Prisma.sql`AND o."createdAt" <= ${salesTo}`
          : Prisma.sql``;

  /** Queue rows for listing-requests tab (badge uses count when another tab is active). */
  const listingRequestTabPrismaWhere: Prisma.ShopListingWhereInput = {
    removedFromListingRequestsAt: null,
    requestStatus: {
      in: [
        ListingRequestStatus.submitted,
        ListingRequestStatus.images_ok,
        ListingRequestStatus.printify_item_created,
        ListingRequestStatus.approved,
      ],
    },
  };

  const sync = typeof sp.sync === "string" ? sp.sync : undefined;
  const syncUpdated = typeof sp.updated === "string" ? sp.updated : undefined;
  const syncCreated = typeof sp.created === "string" ? sp.created : undefined;
  const syncSkipped = typeof sp.skipped === "string" ? sp.skipped : undefined;
  const syncRemoved = typeof sp.removed === "string" ? sp.removed : undefined;
  const syncReason = typeof sp.reason === "string" ? sp.reason : undefined;
  const syncMode = typeof sp.syncMode === "string" ? sp.syncMode : undefined;
  const fullSyncAtRaw = typeof sp.fullSyncAt === "string" ? sp.fullSyncAt : undefined;
  const fullSyncAt =
    fullSyncAtRaw != null
      ? (() => {
          try {
            return decodeURIComponent(fullSyncAtRaw);
          } catch {
            return fullSyncAtRaw;
          }
        })()
      : undefined;
  const tagErr = typeof sp.tag_err === "string" ? sp.tag_err : undefined;
  const saved = typeof sp.saved === "string" ? sp.saved : undefined;
  const listingQueryId =
    typeof sp.listing === "string" ? sp.listing : undefined;
  const tagSaved = typeof sp.tag_saved === "string" ? sp.tag_saved : undefined;
  const savedTagId =
    typeof sp.saved_tag_id === "string" ? sp.saved_tag_id : undefined;
  const pfyHook = typeof sp.pfyHook === "string" ? sp.pfyHook : undefined;
  const pfyHookReason = typeof sp.pfyHookReason === "string" ? sp.pfyHookReason : undefined;
  const pfyHookDetail = typeof sp.pfyHookDetail === "string" ? sp.pfyHookDetail : undefined;
  const pub = typeof sp.pub === "string" ? sp.pub : undefined;
  const pubKind = typeof sp.pubKind === "string" ? sp.pubKind : undefined;
  const pubPid = typeof sp.pubPid === "string" ? sp.pubPid : undefined;
  const pubReason = typeof sp.pubReason === "string" ? sp.pubReason : undefined;
  const pubDetail = typeof sp.pubDetail === "string" ? sp.pubDetail : undefined;
  const r2Prune = typeof sp.r2Prune === "string" ? sp.r2Prune : undefined;
  const r2PruneReason =
    typeof sp.r2PruneReason === "string" ? sp.r2PruneReason : undefined;
  const r2Listed = typeof sp.r2Listed === "string" ? sp.r2Listed : undefined;
  const r2Ref = typeof sp.r2Ref === "string" ? sp.r2Ref : undefined;
  const r2Orphans = typeof sp.r2Orphans === "string" ? sp.r2Orphans : undefined;
  const r2Deleted = typeof sp.r2Deleted === "string" ? sp.r2Deleted : undefined;

  const printifyHookBanner =
    pfyHook === "ok"
      ? {
          variant: "ok" as const,
          text:
            pfyHookDetail === "already"
              ? "This storefront webhook is already registered with Printify."
              : "Registered the order webhook with Printify. They can POST events to your live URL.",
        }
      : pfyHook === "err"
        ? {
            variant: "err" as const,
            text:
              pfyHookReason === "no_shop"
                ? "Set PRINTIFY_SHOP_ID in the environment."
                : pfyHookReason === "no_secret"
                  ? "Set PRINTIFY_WEBHOOK_SECRET (at least 16 random characters) in the environment."
                  : pfyHookReason === "no_public_url"
                    ? "Set NEXT_PUBLIC_APP_URL to your live https origin (or deploy on Vercel so VERCEL_URL is available)."
                    : (() => {
                        try {
                          return decodeURIComponent(pfyHookReason ?? "Something went wrong.");
                        } catch {
                          return pfyHookReason ?? "Something went wrong.";
                        }
                      })(),
          }
        : undefined;

  const printifyPublishNotice =
    pub === "ok"
      ? {
          variant: "ok" as const,
          kind: pubKind === "failed" ? ("failed" as const) : ("succeeded" as const),
          productId: pubPid,
        }
      : pub === "err"
        ? {
            variant: "err" as const,
            reason: pubReason,
            productId: pubPid,
            detail: pubDetail
              ? (() => {
                  try {
                    return decodeURIComponent(pubDetail);
                  } catch {
                    return pubDetail;
                  }
                })()
              : undefined,
          }
        : undefined;

  const loadProducts =
    adminSection === "backend" &&
    (inventoryTab === "printify" || inventoryTab === "tags")
      ? prisma.product.findMany({
          orderBy: [{ name: "asc" }],
          include: {
            primaryTag: true,
            tags: { include: { tag: true } },
          },
        })
      : Promise.resolve([] as AdminProductWithTags[]);

  const loadRemovedRows =
    adminSection === "backend" && inventoryTab === "removed"
      ? prisma.shopListing.findMany({
          where: { removedFromListingRequestsAt: { not: null } },
          orderBy: { removedFromListingRequestsAt: "desc" },
          include: {
            shop: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                fulfillmentType: true,
                imageUrl: true,
                imageGallery: true,
              },
            },
          },
        })
      : Promise.resolve([] as AdminRemovedShopListingLoaded[]);

  let platformSalesLineCount = 0;
  let platformSalesTabLines: AdminPlatformSalesMergedLine[] = [];

  const [
    adminTags,
    productCount,
    listingRequestQueueCount,
    removedListingCount,
    adminListCount,
    supportUnresolvedShopIds,
    deployFootprint,
    products,
    removedListingRows,
  ] = await Promise.all([
    prisma.tag.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.count(),
    prisma.shopListing.count({ where: listingRequestTabPrismaWhere }),
    adminSection === "backend"
      ? prisma.shopListing.count({ where: { removedFromListingRequestsAt: { not: null } } })
      : Promise.resolve(0),
    adminSection === "backend"
      ? prisma.adminCatalogItem.count()
      : Promise.resolve(0),
    supportUnresolvedThreadShopIdsExcludingPlatform(),
    adminSection === "main"
      ? getAdminDeployFootprint()
      : Promise.resolve({
          nextBuildBytes: null,
          nextBuildArtifactBytes: null,
          nextBuildDirPresent: false,
          processCwd: process.cwd(),
          nodeEnv: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          isVercel: Boolean(process.env.VERCEL),
        } satisfies AdminDeployFootprint),
    loadProducts,
    loadRemovedRows,
  ]);

  if (adminSection === "main") {
    const bundle = await loadMergedPlatformSalesLines(prisma, {
      salesOrderCreatedAt,
    });
    platformSalesLineCount = bundle.orderLineCount + bundle.publicationFeePaymentCount;
    if (inventoryTab === "sales") {
      platformSalesTabLines = bundle.lines;
    }
  }

  type ShopLeaderboardQueryRow = {
    shopId: string;
    displayName: string;
    slug: string;
    merchandiseCents: bigint;
    shopCutCents: bigint;
    lineCount: number;
  };

  let shopLeaderboardShopCount = 0;
  let shopLeaderboardRows: AdminShopLeaderboardRow[] = [];
  if (adminSection === "main") {
    const [countBlock, rowBlock] = await Promise.all([
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c FROM (
          SELECT ol."shopId"
          FROM "OrderLine" ol
          INNER JOIN "Order" o ON o.id = ol."orderId"
          WHERE o.status = 'paid'
            AND ol."shopId" IS NOT NULL
            ${leaderboardOrderDateSql}
          GROUP BY ol."shopId"
          HAVING SUM(ol.quantity * ol."unitPriceCents") > 0
        ) t
      `,
      inventoryTab === "shop-leaderboard"
        ? prisma.$queryRaw<ShopLeaderboardQueryRow[]>`
            SELECT
              s.id AS "shopId",
              s."displayName" AS "displayName",
              s.slug AS "slug",
              SUM(ol.quantity * ol."unitPriceCents")::bigint AS "merchandiseCents",
              SUM(ol."shopCutCents")::bigint AS "shopCutCents",
              COUNT(*)::int AS "lineCount"
            FROM "OrderLine" ol
            INNER JOIN "Order" o ON o.id = ol."orderId"
            INNER JOIN "Shop" s ON s.id = ol."shopId"
            WHERE o.status = 'paid'
              ${leaderboardOrderDateSql}
            GROUP BY s.id, s."displayName", s.slug
            HAVING SUM(ol.quantity * ol."unitPriceCents") > 0
            ORDER BY SUM(ol.quantity * ol."unitPriceCents") DESC
          `
        : Promise.resolve([] as ShopLeaderboardQueryRow[]),
    ]);
    shopLeaderboardShopCount =
      countBlock[0]?.c != null ? Number(countBlock[0].c) : 0;
    shopLeaderboardRows = rowBlock.map((r, i) => ({
      rank: i + 1,
      displayName: r.displayName,
      slug: r.slug,
      merchandiseCents: Number(r.merchandiseCents),
      shopCutCents: Number(r.shopCutCents),
      paidLineCount: Number(r.lineCount),
    }));
  }

  let homeTopShopsAdminRows: AdminShopHomeTopRow[] = [];
  if (adminSection === "main" && inventoryTab === "home-top-shops") {
    const raw = await prisma.shop.findMany({
      where: { slug: { not: PLATFORM_SHOP_SLUG } },
      select: {
        id: true,
        slug: true,
        displayName: true,
        active: true,
        totalSalesCents: true,
        editorialPriority: true,
        editorialPinnedUntil: true,
        createdAt: true,
      },
      orderBy: { displayName: "asc" },
    });
    homeTopShopsAdminRows = raw.map((r) => ({
      id: r.id,
      slug: r.slug,
      displayName: r.displayName,
      active: r.active,
      totalSalesCents: r.totalSalesCents,
      editorialPriority: r.editorialPriority,
      editorialPinnedUntil: r.editorialPinnedUntil?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  const removedListingTabRows: RemovedListingRow[] =
    adminSection === "backend" && inventoryTab === "removed"
      ? removedListingRows.map((r) => ({
          id: r.id,
          requestItemName: r.requestItemName,
          removedFromListingRequestsAt: r.removedFromListingRequestsAt?.toISOString() ?? null,
          adminListingRemovalNotes: r.adminListingRemovalNotes,
          shop: { displayName: r.shop.displayName, slug: r.shop.slug },
          product: {
            id: r.product.id,
            name: r.product.name,
            slug: r.product.slug,
            fulfillmentType: r.product.fulfillmentType,
          },
        }))
      : [];

  let listingRequestRows: AdminListingRequestShopListing[] = [];
  if (inventoryTab === "requests") {
    listingRequestRows = await prisma.shopListing.findMany({
      where: listingRequestTabPrismaWhere,
      orderBy: { updatedAt: "desc" },
      include: {
        shop: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            fulfillmentType: true,
            imageUrl: true,
            imageGallery: true,
          },
        },
      },
    });
  }

  const listingRequestShopIds = [...new Set(listingRequestRows.map((r) => r.shopId))];
  const ordinalListingRows =
    listingRequestShopIds.length > 0
      ? await prisma.shopListing.findMany({
          where: { shopId: { in: listingRequestShopIds } },
          orderBy: [{ shopId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: { id: true, shopId: true },
        })
      : [];
  const listingOrdinalById = new Map<string, number>();
  {
    let curShop: string | null = null;
    let idx = 0;
    for (const row of ordinalListingRows) {
      if (row.shopId !== curShop) {
        curShop = row.shopId;
        idx = 0;
      }
      idx++;
      listingOrdinalById.set(row.id, idx);
    }
  }

  /** Drop approved creator listings that are paid or in a free slot (they belong in Shop Data / dashboard only). */
  const listingRequestTabRows = listingRequestRows
    .map((r) => ({
      id: r.id,
      shopId: r.shopId,
      active: r.active,
      adminRemovedFromShopAt: r.adminRemovedFromShopAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
      requestStatus: r.requestStatus,
      requestItemName: r.requestItemName,
      requestImages: r.requestImages,
      listingPrintifyProductId: r.listingPrintifyProductId,
      listingPrintifyVariantId: r.listingPrintifyVariantId,
      listingPrintifyCatalogSyncedAt: r.listingPrintifyCatalogSyncedAt?.toISOString() ?? null,
      listingFeePaidAt: r.listingFeePaidAt?.toISOString() ?? null,
      listingOrdinal: listingOrdinalById.get(r.id) ?? 1,
      adminListingSecondaryImageUrl: r.adminListingSecondaryImageUrl,
      shop: {
        displayName: r.shop.displayName,
        slug: r.shop.slug,
        listingFeeBonusFreeSlots: r.shop.listingFeeBonusFreeSlots,
      },
      product: r.product,
    }))
    .filter((r) => {
      if (r.requestStatus !== ListingRequestStatus.approved) return true;
      if (r.shop.slug === PLATFORM_SHOP_SLUG) return false;
      const fee = listingFeeCentsForOrdinal(
        r.listingOrdinal,
        r.shop.slug,
        r.shop.listingFeeBonusFreeSlots ?? 0,
      );
      if (r.listingFeePaidAt != null || fee === 0) return false;
      return true;
    });

  const listingRequestTabBadgeCount =
    inventoryTab === "requests" ? listingRequestTabRows.length : listingRequestQueueCount;

  let shopWatchRows: ShopWatchRow[] = [];
  let creatorShops: { id: string; displayName: string; slug: string; listingFeeBonusFreeSlots: number | null }[] = [];
  let creatorShopIds: string[] = [];

  if (inventoryTab === "shop-watch") {
    creatorShops = await prisma.shop.findMany({
      where: { slug: { not: PLATFORM_SHOP_SLUG }, active: true },
      select: { id: true, displayName: true, slug: true, listingFeeBonusFreeSlots: true },
      orderBy: { displayName: "asc" },
    });
    creatorShopIds = creatorShops.map((s) => s.id);
  }

  if (inventoryTab === "shop-watch" && creatorShopIds.length > 0) {
    const [paidOrderRows, allCreatorListings, listingRejectionNotices] = await Promise.all([
      prisma.order.findMany({
        where: {
          shopId: { in: creatorShopIds },
          status: OrderStatus.paid,
        },
        select: { shopId: true },
      }),
      prisma.shopListing.findMany({
        where: { shopId: { in: creatorShopIds } },
        select: {
          id: true,
          shopId: true,
          createdAt: true,
          listingFeePaidAt: true,
          active: true,
          requestStatus: true,
          requestItemName: true,
          requestImages: true,
          adminRemovedFromShopAt: true,
          creatorRemovedFromShopAt: true,
          removedFromListingRequestsAt: true,
          adminListingRemovalNotes: true,
          product: { select: { name: true, slug: true, active: true } },
        },
      }),
      prisma.shopOwnerNotice.findMany({
        where: { shopId: { in: creatorShopIds }, kind: "listing_rejected" },
        orderBy: { createdAt: "desc" },
        select: { shopId: true, kind: true, relatedListingId: true, body: true },
      }),
    ]);

    const listingRejectionNoticesByShop = new Map<
      string,
      Array<{ kind: string; relatedListingId: string | null; body: string }>
    >();
    for (const n of listingRejectionNotices) {
      const arr = listingRejectionNoticesByShop.get(n.shopId) ?? [];
      arr.push(n);
      listingRejectionNoticesByShop.set(n.shopId, arr);
    }

    /** Same filters as the former `groupBy` on listings (avoids Prisma 7 aggregate edge cases). */
    const activeByShop = new Map<string, number>();
    const frozenByShop = new Map<string, number>();
    const removedByShop = new Map<string, number>();
    const salesByShop = new Map<string, number>();
    for (const id of creatorShopIds) {
      activeByShop.set(id, 0);
      frozenByShop.set(id, 0);
      removedByShop.set(id, 0);
      salesByShop.set(id, 0);
    }
    for (const l of allCreatorListings) {
      if (l.adminRemovedFromShopAt != null) {
        frozenByShop.set(l.shopId, (frozenByShop.get(l.shopId) ?? 0) + 1);
      }
      if (l.creatorRemovedFromShopAt != null) {
        removedByShop.set(l.shopId, (removedByShop.get(l.shopId) ?? 0) + 1);
      }
      if (
        l.active &&
        l.creatorRemovedFromShopAt == null &&
        l.product.active
      ) {
        activeByShop.set(l.shopId, (activeByShop.get(l.shopId) ?? 0) + 1);
      }
    }
    for (const o of paidOrderRows) {
      const sid = o.shopId;
      if (sid != null) {
        salesByShop.set(sid, (salesByShop.get(sid) ?? 0) + 1);
      }
    }

    const listingsByShop = new Map<string, typeof allCreatorListings>();
    for (const l of allCreatorListings) {
      const arr = listingsByShop.get(l.shopId) ?? [];
      arr.push(l);
      listingsByShop.set(l.shopId, arr);
    }

    const sortDetails = (a: ShopWatchDetail, b: ShopWatchDetail) =>
      a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" });

    const listingFeeKindForShopWatch = (
      shopSlug: string,
      ordinal1Based: number,
      listingId: string,
      listingFeePaidAt: Date | null,
      listingFeeBonusFreeSlots: number,
    ): ShopWatchDetail["listingFeeKind"] => {
      if (SPECIAL_PROMOTION_FREE_LISTING_IDS.has(listingId)) {
        return "free_promo";
      }
      const cents = listingFeeCentsForOrdinal(ordinal1Based, shopSlug, listingFeeBonusFreeSlots);
      if (cents === 0) {
        return isFounderUnlimitedFreeListingsShop(shopSlug) ? "free_promo" : "free_slot";
      }
      return listingFeePaidAt != null ? "paid" : "unpaid";
    };

    shopWatchRows = creatorShops.map((shop) => {
      const shopRejectionNotices = listingRejectionNoticesByShop.get(shop.id) ?? [];
      const listings = listingsByShop.get(shop.id) ?? [];
      const ordinalByListingId = new Map<string, number>();
      [...listings]
        .sort((a, b) => {
          const t = a.createdAt.getTime() - b.createdAt.getTime();
          if (t !== 0) return t;
          return a.id.localeCompare(b.id);
        })
        .forEach((row, i) => ordinalByListingId.set(row.id, i + 1));

      const detailsActiveRaw: ShopWatchDetail[] = [];
      const detailsFrozenRaw: ShopWatchDetail[] = [];
      const detailsRemovedRaw: ShopWatchDetail[] = [];
      const detailsOtherPipelineRaw: ShopWatchDetail[] = [];
      const detailsOtherRequestedRaw: ShopWatchDetail[] = [];
      const detailsOtherApprovedRaw: ShopWatchDetail[] = [];
      const detailsOtherRejectedRaw: ShopWatchDetail[] = [];

      for (const l of listings) {
        const ordinal = ordinalByListingId.get(l.id) ?? 1;
        const listingFeeKind = listingFeeKindForShopWatch(
          shop.slug,
          ordinal,
          l.id,
          l.listingFeePaidAt,
          shop.listingFeeBonusFreeSlots ?? 0,
        );
        const base: Omit<ShopWatchDetail, "rowKind"> = {
          listingId: l.id,
          productName: l.product.name,
          productSlug: l.product.slug,
          listingFeeKind,
          queueRemoved: l.removedFromListingRequestsAt != null,
          notes: l.adminListingRemovalNotes,
        };
        if (l.creatorRemovedFromShopAt != null) {
          detailsRemovedRaw.push({
            ...base,
            rowKind: "removed",
            removalSource: "creator",
          });
        } else if (l.adminRemovedFromShopAt != null) {
          detailsFrozenRaw.push({ ...base, rowKind: "frozen" });
        } else if (l.active && l.creatorRemovedFromShopAt == null && l.product.active) {
          detailsActiveRaw.push({ ...base, rowKind: "active" });
        } else if (
          l.removedFromListingRequestsAt != null &&
          l.creatorRemovedFromShopAt == null &&
          l.adminRemovedFromShopAt == null
        ) {
          detailsRemovedRaw.push({
            ...base,
            rowKind: "removed",
            removalSource: "admin_queue",
            rejectionReasonText: listingRejectionNoticeDetail("other", null),
          });
        } else {
          const row: ShopWatchDetail = {
            ...base,
            rowKind: "other",
            pipelineStatus: l.requestStatus,
            listingActive: l.active,
            productActive: l.product.active,
          };
          if (l.requestStatus === ListingRequestStatus.rejected) {
            const noticeBody = resolveListingRejectionNoticeBody(
              shopRejectionNotices,
              l.id,
              l.product.name,
            );
            detailsOtherRejectedRaw.push({
              ...row,
              rejectionReasonText: listingRejectionReasonTextForCard(noticeBody),
            });
          } else if (l.requestStatus === ListingRequestStatus.approved) {
            detailsOtherApprovedRaw.push(row);
          } else if (
            l.requestStatus === ListingRequestStatus.submitted ||
            l.requestStatus === ListingRequestStatus.images_ok
          ) {
            detailsOtherRequestedRaw.push(row);
          } else {
            detailsOtherPipelineRaw.push(row);
          }
        }
      }

      detailsActiveRaw.sort(sortDetails);
      detailsFrozenRaw.sort(sortDetails);
      detailsRemovedRaw.sort(sortDetails);
      detailsOtherRequestedRaw.sort(sortDetails);
      detailsOtherPipelineRaw.sort(sortDetails);
      detailsOtherApprovedRaw.sort(sortDetails);
      detailsOtherRejectedRaw.sort(sortDetails);

      const detailsActive = detailsActiveRaw;
      const detailsFrozen = detailsFrozenRaw;
      const detailsRemoved = detailsRemovedRaw;
      const detailsOtherPipeline = detailsOtherPipelineRaw;
      const detailsOtherRequested = detailsOtherRequestedRaw;
      const detailsOtherApproved = detailsOtherApprovedRaw;
      const detailsOtherRejected = detailsOtherRejectedRaw;

      const paidListingsCount = listings.reduce((acc, l) => {
        const ordinal = ordinalByListingId.get(l.id) ?? 1;
        return (
          listingFeeKindForShopWatch(
            shop.slug,
            ordinal,
            l.id,
            l.listingFeePaidAt,
            shop.listingFeeBonusFreeSlots ?? 0,
          ) === "paid"
        )
          ? acc + 1
          : acc;
      }, 0);

      return {
        shopId: shop.id,
        displayName: shop.displayName,
        slug: shop.slug,
        activeListingsCount:
          (activeByShop.get(shop.id) ?? 0) + detailsOtherApproved.length,
        salesCount: salesByShop.get(shop.id) ?? 0,
        paidListingsCount,
        frozenCount: frozenByShop.get(shop.id) ?? 0,
        removedCount: detailsRemoved.length + detailsOtherRejected.length,
        detailsActive,
        detailsFrozen,
        detailsRemoved,
        detailsOtherRequested,
        detailsOtherPipeline,
        detailsOtherApproved,
        detailsOtherRejected,
      };
    });
    shopWatchRows.sort(
      (a, b) =>
        b.frozenCount + b.removedCount - (a.frozenCount + a.removedCount) ||
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    );
  }

  let shopWatchTabBadgeCount = 0;
  if (inventoryTab === "shop-watch") {
    shopWatchTabBadgeCount = shopWatchRows.filter(
      (r) => r.frozenCount + r.removedCount > 0,
    ).length;
  } else {
    shopWatchTabBadgeCount = await prisma.shop.count({
      where: {
        slug: { not: PLATFORM_SHOP_SLUG },
        listings: {
          some: {
            OR: [
              { adminRemovedFromShopAt: { not: null } },
              { creatorRemovedFromShopAt: { not: null } },
            ],
          },
        },
      },
    });
  }

  let creatorAccountCount = 0;
  let shopsWithListingCount = 0;
  let shopsWithPaidListingCount = 0;
  if (inventoryTab === "shop-watch") {
    const counts = await Promise.all([
      prisma.shopUser.count({
        where: { shop: { slug: { not: PLATFORM_SHOP_SLUG } } },
      }),
      prisma.shop.count({
        where: {
          slug: { not: PLATFORM_SHOP_SLUG },
          listings: { some: {} },
        },
      }),
      prisma.shop.count({
        where: {
          slug: { not: PLATFORM_SHOP_SLUG },
          listings: { some: { listingFeePaidAt: { not: null } } },
        },
      }),
    ]);
    creatorAccountCount = counts[0];
    shopsWithListingCount = counts[1];
    shopsWithPaidListingCount = counts[2];
  }

  const printifyProducts = products;

  /** Live Printify shop catalog (Printify + Requests tabs only — avoids slow remote fetch on every admin load). */
  let printifyCatalogItemCount: number | null = null;
  let printifyCatalogPickList: {
    id: string;
    title: string;
    defaultVariantId: string | null;
  }[] = [];
  const printifyShopIdEnv = process.env.PRINTIFY_SHOP_ID?.trim() ?? "";
  if (
    hasPrintifyApiToken() &&
    printifyShopIdEnv &&
    ((adminSection === "main" && inventoryTab === "requests") ||
      (adminSection === "backend" && inventoryTab === "printify"))
  ) {
    try {
      const catalog = await fetchPrintifyCatalog(printifyShopIdEnv);
      printifyCatalogItemCount = catalog.length;
      printifyCatalogPickList = [...catalog]
        .map((p) => ({
          id: p.id.trim(),
          title: p.title.trim() || p.id,
          defaultVariantId: defaultPrintifyVariantIdForCatalogProduct(p),
          catalogUpdatedAt: p.updatedAt?.getTime() ?? 0,
        }))
        .filter((p) => p.id.length > 0)
        .sort((a, b) => b.catalogUpdatedAt - a.catalogUpdatedAt);
    } catch {
      printifyCatalogItemCount = null;
      printifyCatalogPickList = [];
    }
  }

  let printifyProductIdsMappedToShopListings: string[] = [];
  if (inventoryTab === "requests") {
    try {
      const mappedShopListingPrintifyRows = await prisma.shopListing.findMany({
        where: { listingPrintifyProductId: { not: null } },
        select: { listingPrintifyProductId: true },
      });
      printifyProductIdsMappedToShopListings = [
        ...new Set(
          mappedShopListingPrintifyRows
            .map((row) => row.listingPrintifyProductId?.trim())
            .filter((id): id is string => Boolean(id)),
        ),
      ];
    } catch (e) {
      console.error("[admin] printifyProductIdsMappedToShopListings query failed", e);
    }
  }

  const printifyTabBadgeCount = printifyCatalogItemCount ?? productCount;

  const knownDesignNames = collectKnownDesignNamesFromProducts(products);

  const defaultCreateTagIds = adminTags[0] ? [adminTags[0].id] : [];

  const supportUnresolvedCount = supportUnresolvedShopIds.size;

  let adminSupportThreads: AdminSupportThreadListRow[] = [];
  let adminSupportDetail: AdminSupportThreadDetail | null = null;

  if (inventoryTab === "support") {
    const threadsRaw = await prisma.supportThread.findMany({
      where: { shop: { slug: { not: PLATFORM_SHOP_SLUG } } },
      orderBy: { updatedAt: "desc" },
      include: {
        shop: {
          select: {
            displayName: true,
            slug: true,
            users: { take: 1, orderBy: { createdAt: "asc" }, select: { email: true } },
          },
        },
      },
    });
    adminSupportThreads = threadsRaw.map((t) => ({
      shopId: t.shopId,
      shopDisplayName: t.shop.displayName,
      shopSlug: t.shop.slug,
      ownerEmail: t.shop.users[0]?.email ?? "—",
      updatedAt: t.updatedAt.toISOString(),
      needsReply: supportUnresolvedShopIds.has(t.shopId),
    }));

    if (supportShopParam) {
      const shopRow = await prisma.shop.findFirst({
        where: { id: supportShopParam, slug: { not: PLATFORM_SHOP_SLUG } },
        select: {
          id: true,
          displayName: true,
          slug: true,
          users: { take: 1, orderBy: { createdAt: "asc" }, select: { email: true } },
        },
      });
      if (shopRow) {
        const existingThread = await prisma.supportThread.findUnique({
          where: { shopId: shopRow.id },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });
        adminSupportDetail = {
          shopId: shopRow.id,
          shopDisplayName: shopRow.displayName,
          shopSlug: shopRow.slug,
          ownerEmail: shopRow.users[0]?.email ?? "—",
          needsReply: supportUnresolvedShopIds.has(shopRow.id),
          resolvedAtIso: existingThread?.resolvedAt?.toISOString() ?? null,
          messages:
            existingThread?.messages.map((m) => ({
              id: m.id,
              authorRole: m.authorRole as "creator" | "admin",
              body: m.body,
              createdAt: m.createdAt.toISOString(),
            })) ?? [],
        };
      }
    }
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="text-xl font-semibold">
            {adminSection === "main" ? "Admin Dash" : "Backend admin"}
          </h1>
          {adminSection === "main" ? (
            <Link
              prefetch={false}
              href={ADMIN_BACKEND_BASE_PATH}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
            >
              Backend admin →
            </Link>
          ) : (
            <Link
              prefetch={false}
              href={`${ADMIN_MAIN_BASE_PATH}?tab=support`}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
            >
              ← Admin Dash
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      {adminSection === "main" && productCount === 0 ? (
        <div
          role="status"
          className="rounded-lg border border-amber-900/45 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/90"
        >
          <p className="font-medium text-amber-50/95">No products in this database</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-200/85">
            Admin and the shop use the same PostgreSQL connection. If both look empty, this environment is
            almost certainly using a database with no product rows yet, or a different database than where you
            created data (for example only on your laptop, not on Vercel).
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs text-amber-200/80">
            <li>
              Confirm{" "}
              <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
                POSTGRES_PRISMA_URL
              </code>{" "}
              or{" "}
              <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
                DATABASE_URL
              </code>{" "}
              in this deployment (e.g. Vercel → Production) points at the database you intend.
            </li>
            <li>
              Run{" "}
              <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
                npx prisma migrate deploy
              </code>{" "}
              and{" "}
              <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
                npm run db:seed
              </code>{" "}
              from your machine using that same URL (see VERCEL.md).
            </li>
            <li>
              Or add listings in Admin Dash / Backend admin (and sync Printify if you use it)—they are stored only in the
              database your env points to.
            </li>
          </ul>
        </div>
      ) : null}

      {adminSection === "main" ? (
      <section
        aria-label="Production deployment footprint"
        className="rounded-lg border border-zinc-800 bg-zinc-900/35 px-4 py-3 text-xs text-zinc-400"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Production footprint (this host)
        </h2>
        <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="text-zinc-600">Next.js build (artifact size)</dt>
            <dd className="font-mono text-sm text-zinc-200">
              {deployFootprint.nextBuildDirPresent
                ? deployFootprint.nextBuildArtifactBytes != null
                  ? formatBytesForAdmin(deployFootprint.nextBuildArtifactBytes)
                  : deployFootprint.nextBuildBytes != null
                    ? formatBytesForAdmin(deployFootprint.nextBuildBytes)
                    : "`.next` present (size unavailable)"
                : "No `.next` folder at process cwd"}
            </dd>
            {deployFootprint.nextBuildBytes != null &&
            deployFootprint.nextBuildArtifactBytes != null &&
            deployFootprint.nextBuildBytes !== deployFootprint.nextBuildArtifactBytes ? (
              <dd className="mt-1 font-mono text-[10px] text-zinc-600">
                Full <code className="text-zinc-500">.next</code> incl. dev caches:{" "}
                {formatBytesForAdmin(deployFootprint.nextBuildBytes)}
              </dd>
            ) : null}
            <dd className="mt-0.5 max-w-full truncate font-mono text-[10px] text-zinc-600" title={deployFootprint.processCwd}>
              {deployFootprint.processCwd}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-600">Runtime</dt>
            <dd className="font-mono text-sm text-zinc-200">
              NODE_ENV={deployFootprint.nodeEnv ?? "—"}
              {deployFootprint.isVercel ? (
                <>
                  {" · "}
                  VERCEL_ENV={deployFootprint.vercelEnv ?? "—"}
                </>
              ) : null}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
          Primary figure excludes <code className="text-zinc-500">.next/cache</code> and{" "}
          <code className="text-zinc-500">.next/dev</code> when present — closer to what a{" "}
          <code className="text-zinc-500">next build</code> / production host keeps than the raw dev-server folder size.
          It is not the git repo size and does not include <code className="text-zinc-500">node_modules</code>. When
          caches exist locally, the secondary line shows full <code className="text-zinc-500">.next</code>.
        </p>
      </section>
      ) : null}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40">
        <nav
          className="flex flex-nowrap gap-1 overflow-x-auto border-b border-zinc-800 px-2 pt-2"
          aria-label={adminSection === "main" ? "Admin Dash sections" : "Backend admin sections"}
        >
          {adminSection === "main" ? (
            <>
          <Link
            href={`${basePath}?tab=support`}
            role="tab"
            title={`${supportUnresolvedCount} unresolved support conversation(s) (needs reply or not marked resolved)`}
            aria-selected={inventoryTab === "support"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "support"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Support
            <span className="ml-1.5 tabular-nums text-zinc-500">({supportUnresolvedCount})</span>
          </Link>
          <Link
            href={`${basePath}?tab=admin-inbox`}
            role="tab"
            aria-selected={inventoryTab === "admin-inbox"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "admin-inbox"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Inbox
            <span className="ml-1.5 tabular-nums text-zinc-500">({adminInboxCount})</span>
          </Link>
          <Link
            href={`${basePath}?tab=requests`}
            role="tab"
            aria-selected={inventoryTab === "requests"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "requests"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Requests
            <span className="ml-1.5 tabular-nums text-zinc-500">({listingRequestTabBadgeCount})</span>
          </Link>
          <Link
            href={`${basePath}?tab=shop-watch`}
            role="tab"
            aria-selected={inventoryTab === "shop-watch"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "shop-watch"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Shop Data
            <span className="ml-1.5 tabular-nums text-zinc-500">({shopWatchTabBadgeCount})</span>
          </Link>
          <Link
            href={`${basePath}?tab=shop-leaderboard`}
            role="tab"
            aria-selected={inventoryTab === "shop-leaderboard"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "shop-leaderboard"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Shop leaderboard
            <span className="ml-1.5 tabular-nums text-zinc-500">({shopLeaderboardShopCount})</span>
          </Link>
          <Link
            href={`${basePath}?tab=home-top-shops`}
            role="tab"
            aria-selected={inventoryTab === "home-top-shops"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "home-top-shops"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Home top shops
          </Link>
          <Link
            href={`${basePath}?tab=sales`}
            role="tab"
            aria-selected={inventoryTab === "sales"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "sales"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Platform sales
            <span className="ml-1.5 tabular-nums text-zinc-500">({platformSalesLineCount})</span>
          </Link>
            </>
          ) : (
            <>
          <Link
            href={`${basePath}?tab=admin-list`}
            role="tab"
            aria-selected={inventoryTab === "admin-list"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "admin-list"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Admin list
            <span className="ml-1.5 tabular-nums text-zinc-500">({adminListCount})</span>
          </Link>
          <Link
            href={`${basePath}?tab=printify`}
            role="tab"
            aria-selected={inventoryTab === "printify"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "printify"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Printify items
            <span className="ml-1.5 tabular-nums text-zinc-500">({printifyTabBadgeCount})</span>
          </Link>
          <Link
            href={`${basePath}?tab=removed`}
            role="tab"
            aria-selected={inventoryTab === "removed"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "removed"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Removed items
            <span className="ml-1.5 tabular-nums text-zinc-500">({removedListingCount})</span>
          </Link>
          <Link
            href={`${basePath}?tab=email-format`}
            role="tab"
            aria-selected={inventoryTab === "email-format"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "email-format"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Email format
          </Link>
          <Link
            href={`${basePath}?tab=tags`}
            role="tab"
            aria-selected={inventoryTab === "tags"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "tags"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Tags
            <span className="ml-1.5 tabular-nums text-zinc-500">({adminTags.length})</span>
          </Link>
          <Link
            href={`${basePath}?tab=printify-api`}
            role="tab"
            aria-selected={inventoryTab === "printify-api"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "printify-api"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Printify API
          </Link>
            </>
          )}
        </nav>

        <div className="p-4 pt-6 sm:p-6">
          {adminSection === "main" ? (
            inventoryTab === "support" ? (
            <AdminSupportMessagesTab
              threads={adminSupportThreads}
              detail={adminSupportDetail}
              selectedShopId={supportShopParam}
            />
          ) : inventoryTab === "requests" ? (
            <AdminListingRequestsTab
              rows={listingRequestTabRows}
              printifyCatalogPickList={printifyCatalogPickList}
              printifyProductIdsMappedToShopListings={printifyProductIdsMappedToShopListings}
              r2Configured={isR2UploadConfigured()}
            />
          ) : inventoryTab === "shop-watch" ? (
            <AdminShopWatchTab
              rows={shopWatchRows}
              marketplaceStats={{
                creatorAccountCount,
                shopsWithListingCount,
                shopsWithPaidListingCount,
              }}
              initialExpandedShopId={watchShopParam}
            />
          ) : inventoryTab === "shop-leaderboard" ? (
            <AdminShopLeaderboardTab
              rows={shopLeaderboardRows}
              salesFromValue={salesFromRaw}
              salesToValue={salesToRaw}
            />
          ) : inventoryTab === "home-top-shops" ? (
            <AdminShopHomeTopTab rows={homeTopShopsAdminRows} />
          ) : inventoryTab === "sales" ? (
            <AdminPlatformSalesTab
              lines={platformSalesTabLines}
              salesFromValue={salesFromRaw}
              salesToValue={salesToRaw}
            />
          ) : inventoryTab === "admin-inbox" ? (
            <AdminInboxTab
              rows={adminInboxRowsLoaded}
              inboxAddress={adminInboxEmailAddress()}
              webhookEndpoint={adminInboxWebhookEndpoint}
            />
          ) : null)
          : (
            inventoryTab === "admin-list" ? (
            <AdminListTab />
          ) : inventoryTab === "printify" ? (
            <PrintifyInventoryTab
              products={printifyProducts}
              allTags={adminTags}
              sync={sync}
              syncMode={syncMode}
              fullSyncAtIso={fullSyncAt}
              syncUpdated={syncUpdated}
              syncCreated={syncCreated}
              syncSkipped={syncSkipped}
              syncRemoved={syncRemoved}
              syncReason={syncReason}
              openListingId={listingQueryId}
              listingSavedId={
                saved === "product" ? listingQueryId : undefined
              }
              publishNotice={printifyPublishNotice}
              r2PruneNotice={
                r2Prune === "preview" && r2Listed !== undefined
                  ? {
                      variant: "preview",
                      listed: parseInt(r2Listed, 10) || 0,
                      referenced: parseInt(r2Ref ?? "0", 10) || 0,
                      orphans: parseInt(r2Orphans ?? "0", 10) || 0,
                    }
                  : r2Prune === "ok" && r2Listed !== undefined
                    ? {
                        variant: "ok",
                        listed: parseInt(r2Listed, 10) || 0,
                        referenced: parseInt(r2Ref ?? "0", 10) || 0,
                        orphans: parseInt(r2Orphans ?? "0", 10) || 0,
                        deleted: parseInt(r2Deleted ?? "0", 10) || 0,
                      }
                    : r2Prune === "err"
                      ? {
                          variant: "err",
                          reason: r2PruneReason ?? "Unknown error.",
                        }
                      : undefined
              }
            />
          ) : inventoryTab === "removed" ? (
            <AdminRemovedListingItemsTab rows={removedListingTabRows} />
          ) : inventoryTab === "email-format" ? (
            <AdminEmailFormatTab entries={emailFormatTabEntries} />
          ) : inventoryTab === "tags" ? (
            <section id="tags" aria-label="Shop tags">
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                Shop tags
              </h2>
              {tagSaved === "created" ||
              tagSaved === "updated" ||
              tagSaved === "deleted" ? (
                <p
                  role="status"
                  className="mt-2 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
                >
                  {tagSaved === "created"
                    ? "Tag created."
                    : tagSaved === "updated"
                      ? "Tag saved."
                      : "Tag deleted."}
                </p>
              ) : null}
              {tagErr ? (
                <p className="mt-2 rounded border border-blue-900/50 bg-blue-950/30 px-3 py-2 text-xs text-blue-200/90">
                  {tagErr}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-600">
                Tags are shared across the shop. Optional: set a “By Item” top pick per tag below.
              </p>
              <ul className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
                {adminTags.map((t) => {
                  const effectiveSpotlightId = t.byItemSpotlightProductId;
                  const byItemSpotlightDefault =
                    effectiveSpotlightId &&
                    products.some(
                      (p) =>
                        p.id === effectiveSpotlightId && productHasTag(p, t.id),
                    )
                      ? effectiveSpotlightId
                      : "__auto__";
                  return (
                  <li
                    key={t.id}
                    className="flex flex-col gap-3 py-3 text-zinc-300 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
                  >
                    <form
                      action={adminUpdateTagForm}
                      className="flex min-w-0 flex-1 flex-col gap-2"
                    >
                      <input type="hidden" name="tagId" value={t.id} />
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="block text-[11px] text-zinc-500">
                          Name
                          <input
                            type="text"
                            name="name"
                            required
                            defaultValue={t.name}
                            className="mt-0.5 block w-36 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 sm:w-40"
                          />
                        </label>
                        <label className="block text-[11px] text-zinc-500">
                          Slug
                          <input
                            type="text"
                            name="slug"
                            defaultValue={t.slug}
                            className="mt-0.5 block w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 sm:w-36"
                          />
                        </label>
                        <label className="block text-[11px] text-zinc-500">
                          Sort
                          <input
                            type="number"
                            name="sortOrder"
                            defaultValue={t.sortOrder}
                            className="mt-0.5 block w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                          />
                        </label>
                        <button
                          type="submit"
                          className={
                            tagSaved === "updated" && savedTagId === t.id
                              ? "rounded border border-emerald-600/70 bg-emerald-950/45 px-2.5 py-1 text-[11px] font-medium text-emerald-100/95 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.2)]"
                              : "rounded border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
                          }
                          aria-label={
                            tagSaved === "updated" && savedTagId === t.id
                              ? "Tag saved"
                              : "Save tag"
                          }
                        >
                          {tagSaved === "updated" && savedTagId === t.id
                            ? "Saved"
                            : "Save"}
                        </button>
                      </div>
                      <div className="flex w-full min-w-0 max-w-full flex-col gap-1.5 sm:max-w-[min(100%,32rem)]">
                        <label className="block text-[11px] text-zinc-500">
                          By Item top pick
                          <select
                            name="byItemSpotlightProductId"
                            defaultValue={byItemSpotlightDefault}
                            className="mt-0.5 block max-w-[min(100%,20rem)] rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                            title="Which product represents this tag in the By Item browse (must have this tag)."
                          >
                            <option value="__auto__">Auto (first A–Z)</option>
                            {products
                              .filter((p) => productHasTag(p, t.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                    </form>
                    <div className="flex shrink-0 items-center gap-3 sm:pb-0.5">
                      <ConfirmDeleteForm
                        action={adminDeleteTagForm}
                        message={`Delete tag “${t.name}”? Only if no products use it.`}
                      >
                        <input type="hidden" name="tagId" value={t.id} />
                        <button
                          type="submit"
                          className="text-[11px] text-blue-400/90 hover:underline"
                        >
                          Delete
                        </button>
                      </ConfirmDeleteForm>
                    </div>
                  </li>
                  );
                })}
              </ul>
              {adminTags.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600">No tags — run db seed.</p>
              ) : null}
              <form
                action={adminCreateTagForm}
                className="mt-6 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <label className="block text-xs text-zinc-500">
                  Name
                  <input
                    type="text"
                    name="name"
                    required
                    className="mt-1 block w-40 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Slug (optional)
                  <input
                    type="text"
                    name="slug"
                    className="mt-1 block w-36 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Sort
                  <input
                    type="number"
                    name="sortOrder"
                    defaultValue={99}
                    className="mt-1 block w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded bg-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700"
                >
                  Add tag
                </button>
              </form>
            </section>
          ) : inventoryTab === "printify-api" ? (
            <PrintifyApiTab hookBanner={printifyHookBanner} />
          ) : null
          )}
        </div>
      </div>

      <Link href="/" className="text-xs text-zinc-600 hover:underline">
        ← Home
      </Link>
    </div>
  );
}
