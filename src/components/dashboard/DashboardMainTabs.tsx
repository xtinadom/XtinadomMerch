"use client";

import type { ReactNode } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { useId, useState } from "react";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";
import {
  dashboardCreatorRemoveListingFromShop,
  dashboardPayListingFee,
} from "@/actions/dashboard-marketplace";
import {
  LISTING_FEE_FREE_SLOT_COUNT,
  isFounderUnlimitedFreeListingsShop,
  listingFeeCentsForOrdinal,
} from "@/lib/marketplace-constants";
import {
  DashboardListingItemNameForm,
  DashboardListingPriceForm,
  DashboardListingSupplementPhotoForm,
  DashboardSubmitListingRequestForm,
  ListingStorefrontCatalogImagesForms,
} from "@/components/dashboard/DashboardListingForms";
import { ShopProfileSetupPanel } from "@/components/dashboard/ShopProfileSetupPanel";
import {
  ShopSetupTabs,
  type ShopSetupShopPayload,
  type ShopSetupSteps,
} from "@/components/dashboard/ShopSetupTabs";
import { ShopItemGuidelinesPanel } from "@/components/dashboard/ShopItemGuidelinesPanel";
import { ShopFirstListingRequestPanel } from "@/components/dashboard/ShopFirstListingRequestPanel";
import type { DraftListingRequestPrefillPayload } from "@/lib/shop-baseline-draft-prefill";
import type { ShopSetupCatalogGroup } from "@/lib/shop-baseline-catalog";
import { dashboardMarkOwnerNoticeRead } from "@/actions/shop-dashboard-notices";
import { DashboardNoticeMarkReadButton } from "@/components/dashboard/DashboardNoticeMarkReadButton";
import { DashboardNoticeBody } from "@/components/dashboard/DashboardNoticeBody";
import { dashboardListingMinPriceHintCents } from "@/lib/listing-cart-price";
import {
  parseListingStorefrontCatalogImageSelection,
  productImageUrlsUnionHero,
} from "@/lib/product-media";
import type { GroupedDashboardListing } from "@/lib/dashboard-legacy-baseline-listing-groups";

export type DashboardSetupPanelProps = {
  setupTabsKey: string;
  shop: ShopSetupShopPayload;
  itemGuidelinesAcknowledged: boolean;
  catalogGroups: ShopSetupCatalogGroup[];
  steps: ShopSetupSteps;
  stripeConnectUnlocked: boolean;
  incompleteSetupCount: number;
  listingFeePolicySummary: string;
  r2Configured: boolean;
  listingPickerDiagnostics?: { adminCatalogItemCount: number };
};

export type DashboardListingRow = {
  id: string;
  active: boolean;
  requestStatus: ListingRequestStatus;
  priceCents: number;
  requestImages: unknown;
  /** Optional admin-set second storefront image (approved listings). */
  adminListingSecondaryImageUrl: string | null;
  /** Optional extra image on the public storefront (approved listings). */
  ownerSupplementImageUrl: string | null;
  /** Shop label for this listing request (optional). */
  requestItemName: string | null;
  listingFeePaidAt: string | null;
  adminRemovedFromShopAt: string | null;
  creatorRemovedFromShopAt: string | null;
  /** 1-based order by shop creation time (oldest = 1). */
  listingOrdinal: number;
  /** Extracted from the newest `listing_rejected` notice when status is rejected. */
  rejectionReasonText: string | null;
  /** JSON string[] or null — which catalog URLs show on the public PDP. */
  listingStorefrontCatalogImageUrls: unknown;
  listingPrintifyVariantId: string | null;
  listingPrintifyVariantPrices: unknown;
  product: {
    name: string;
    slug: string;
    minPriceCents: number;
    priceCents: number;
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
    fulfillmentType: FulfillmentType;
    printifyVariantId: string | null;
    printifyVariants: Prisma.JsonValue | null;
  };
};

export type DashboardPaidOrderRow = {
  id: string;
  createdAt: string;
  totalCents: number;
  lines: Array<{
    productName: string;
    quantity: number;
    unitPriceCents: number;
    platformCutCents: number;
    shopCutCents: number;
  }>;
};

export type DashboardNoticeRow = {
  id: string;
  body: string;
  kind: string;
  createdAt: string;
  readAt: string | null;
};

function formatNoticeWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function requestStatusDescription(status: ListingRequestStatus): string {
  switch (status) {
    case ListingRequestStatus.draft:
      return "Draft — finish artwork / URLs and submit when ready.";
    case ListingRequestStatus.submitted:
      return "Submitted — waiting for admin to run the image check.";
    case ListingRequestStatus.images_ok:
      return "In review — image check passed; admin is linking Printify. Your listing badge stays In review until approval.";
    case ListingRequestStatus.printify_item_created:
      return "Printify item created — waiting for admin approval.";
    case ListingRequestStatus.approved:
      return "Approved — goes live when the publication fee is settled (if required for this slot).";
    case ListingRequestStatus.rejected:
      return "Rejected — this listing cannot be edited. Contact support if you need help.";
    default:
      return String(status);
  }
}

function statusBadgeClass(status: ListingRequestStatus, active: boolean): string {
  if (active) return "bg-emerald-950/50 text-emerald-300/90 ring-emerald-800/50";
  switch (status) {
    case ListingRequestStatus.submitted:
      return "bg-amber-950/40 text-amber-200/90 ring-amber-800/50";
    case ListingRequestStatus.images_ok:
      return "bg-amber-950/40 text-amber-200/90 ring-amber-800/50";
    case ListingRequestStatus.printify_item_created:
      return "bg-violet-950/40 text-violet-200/90 ring-violet-800/50";
    case ListingRequestStatus.approved:
      return "bg-sky-950/40 text-sky-200/90 ring-sky-800/50";
    case ListingRequestStatus.rejected:
      return "bg-red-950/40 text-red-200/90 ring-red-900/50";
    default:
      return "bg-zinc-900/80 text-zinc-400 ring-zinc-700/80";
  }
}

function buildListingDerived(
  listing: DashboardListingRow,
  shopSlug: string,
  isPlatform: boolean,
) {
  const minCents = dashboardListingMinPriceHintCents(listing.product);
  const minLabel = formatMoney(minCents);
  const listingLocked =
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null;
  const awaitingAdminReview =
    listing.requestStatus === ListingRequestStatus.submitted ||
    listing.requestStatus === ListingRequestStatus.images_ok ||
    listing.requestStatus === ListingRequestStatus.printify_item_created;
  const fieldsReadOnly = listingLocked || awaitingAdminReview;
  const canSubmit =
    !listingLocked && listing.requestStatus === ListingRequestStatus.draft;
  const imagesDefault = Array.isArray(listing.requestImages)
    ? (listing.requestImages as string[]).join("\n")
    : "";
  const feeCents = listingFeeCentsForOrdinal(listing.listingOrdinal, shopSlug);
  const isFreeListingSlot = feeCents === 0;
  const founderFreeShop = isFounderUnlimitedFreeListingsShop(shopSlug);
  const dashboardBadge = listing.creatorRemovedFromShopAt
    ? {
        label: "Creator removed",
        ringClass: "bg-fuchsia-950/45 text-fuchsia-200/90 ring-fuchsia-800/50",
      }
    : listing.adminRemovedFromShopAt
      ? {
          label: "Frozen",
          ringClass: "bg-sky-950/50 text-sky-200/90 ring-sky-800/50",
        }
      : listing.requestStatus === ListingRequestStatus.rejected
        ? {
            label: "Rejected",
            ringClass: "bg-red-950/40 text-red-200/90 ring-red-900/50",
          }
        : listing.active
          ? {
              label: "Live",
              ringClass: statusBadgeClass(listing.requestStatus, true),
            }
          : {
              label: !isPlatform
                ? listing.requestStatus === ListingRequestStatus.draft
                  ? "Draft"
                  : listing.requestStatus === ListingRequestStatus.approved
                    ? "Fee pending"
                    : listing.requestStatus === ListingRequestStatus.submitted ||
                        listing.requestStatus === ListingRequestStatus.images_ok ||
                        listing.requestStatus === ListingRequestStatus.printify_item_created
                      ? "In review"
                      : String(listing.requestStatus)
                : String(listing.requestStatus),
              ringClass: statusBadgeClass(listing.requestStatus, false),
            };
  const canRemoveFromShop =
    !isPlatform &&
    listing.requestStatus === ListingRequestStatus.approved &&
    listing.active &&
    !listing.creatorRemovedFromShopAt &&
    !listing.adminRemovedFromShopAt;
  const showOwnerSupplementSection =
    !isPlatform &&
    listing.requestStatus === ListingRequestStatus.approved &&
    listing.creatorRemovedFromShopAt == null;
  const canEditOwnerSupplement =
    showOwnerSupplementSection && listing.adminRemovedFromShopAt == null;
  const catalogUrls = productImageUrlsUnionHero({
    imageUrl: listing.product.imageUrl,
    imageGallery: listing.product.imageGallery,
  });
  const savedCatalogSelection = parseListingStorefrontCatalogImageSelection(
    listing.listingStorefrontCatalogImageUrls,
  );
  const showCatalogImagePicker =
    showOwnerSupplementSection && canEditOwnerSupplement && catalogUrls.length > 0;

  return {
    minLabel,
    listingLocked,
    awaitingAdminReview,
    fieldsReadOnly,
    canSubmit,
    imagesDefault,
    feeCents,
    isFreeListingSlot,
    founderFreeShop,
    dashboardBadge,
    canRemoveFromShop,
    showOwnerSupplementSection,
    canEditOwnerSupplement,
    catalogUrls,
    savedCatalogSelection,
    showCatalogImagePicker,
  };
}

function ListingOptionPanel({
  listing,
  isPlatform,
  paidListingFeeLabel,
  shopSlug,
  r2Configured,
  variantLabel,
  stacked,
}: {
  listing: DashboardListingRow;
  isPlatform: boolean;
  paidListingFeeLabel: string;
  shopSlug: string;
  r2Configured: boolean;
  /** When set (legacy grouped card), show per-option catalog line. */
  variantLabel?: string;
  /** Second+ option in a legacy group — add top divider. */
  stacked?: boolean;
}) {
  const d = buildListingDerived(listing, shopSlug, isPlatform);
  const {
    minLabel,
    listingLocked,
    awaitingAdminReview,
    fieldsReadOnly,
    canSubmit,
    imagesDefault,
    feeCents,
    isFreeListingSlot,
    founderFreeShop,
    canRemoveFromShop,
    showOwnerSupplementSection,
    canEditOwnerSupplement,
    catalogUrls,
    savedCatalogSelection,
    showCatalogImagePicker,
  } = d;
  const removeFormId = `creator-remove-listing-${listing.id}`;

  return (
    <div className={stacked ? "mt-4 border-t border-zinc-800/80 pt-4" : ""}>
      {variantLabel ? (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Option: {variantLabel}</p>
      ) : null}
      {variantLabel && listing.rejectionReasonText ? (
        <p className="mb-2 text-xs leading-snug text-red-200/85">
          <DashboardNoticeBody body={listing.rejectionReasonText} />
        </p>
      ) : null}
      <p className="mt-1 text-xs text-zinc-600">
        {variantLabel ? (
          <>
            Catalog stub {listing.product.slug} · min {minLabel}
            {listing.requestItemName?.trim() ? (
              <>
                {" "}
                · baseline: <span className="text-zinc-500">{listing.product.name}</span>
              </>
            ) : null}
          </>
        ) : (
          <>
            Catalog: {listing.product.slug} · min {minLabel}
            {listing.requestItemName?.trim() ? (
              <>
                {" "}
                · baseline name: <span className="text-zinc-500">{listing.product.name}</span>
              </>
            ) : null}
          </>
        )}
      </p>

      <DashboardListingPriceForm
        listingId={listing.id}
        priceDollarsFormatted={(listing.priceCents / 100).toFixed(2)}
        listingPriceCents={listing.priceCents}
        listingPrintifyVariantPrices={listing.listingPrintifyVariantPrices}
        product={{
          fulfillmentType: listing.product.fulfillmentType,
          priceCents: listing.product.priceCents,
          minPriceCents: listing.product.minPriceCents,
          printifyVariantId: listing.product.printifyVariantId,
          printifyVariants: listing.product.printifyVariants,
        }}
        readOnly={fieldsReadOnly}
      />

      {showOwnerSupplementSection && listing.adminListingSecondaryImageUrl ? (
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <p className="text-xs font-medium text-zinc-500">Platform listing photo</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Added by the platform. It shows on your public listing with the main product images — you cannot remove it
            here.
          </p>
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.adminListingSecondaryImageUrl}
              alt=""
              className="h-24 w-24 rounded border border-zinc-700 object-cover"
            />
          </div>
        </div>
      ) : null}
      {showOwnerSupplementSection ? (
        <DashboardListingSupplementPhotoForm
          listingId={listing.id}
          ownerSupplementImageUrl={listing.ownerSupplementImageUrl}
          r2Configured={r2Configured}
          canEdit={canEditOwnerSupplement}
        />
      ) : null}

      {showCatalogImagePicker ? (
        <ListingStorefrontCatalogImagesForms
          key={listing.id}
          listingId={listing.id}
          catalogUrls={catalogUrls}
          savedCatalogSelection={savedCatalogSelection}
        />
      ) : null}

      {canRemoveFromShop ? (
        <form
          id={removeFormId}
          action={dashboardCreatorRemoveListingFromShop}
          className="mt-3"
          onSubmit={(e) => {
            const ok = window.confirm(
              `Are you sure you want to remove this listing from your shop? You cannot undo this action, and all listings after your first ${LISTING_FEE_FREE_SLOT_COUNT} will cost ${paidListingFeeLabel}.`,
            );
            if (!ok) e.preventDefault();
          }}
        >
          <input type="hidden" name="listingId" value={listing.id} />
          <button
            type="submit"
            className="rounded border border-red-900/55 bg-red-950/35 px-3 py-1.5 text-xs font-medium text-red-200/95 hover:border-red-700/60 hover:bg-red-950/50"
          >
            Remove from shop
          </button>
        </form>
      ) : null}

      {!isPlatform && isFreeListingSlot ? (
        <p className="mt-2 text-xs text-emerald-600/90">
          {founderFreeShop
            ? "No publication fee — founder shop (unlimited free listings)."
            : `No publication fee — free listing (${listing.listingOrdinal} of ${LISTING_FEE_FREE_SLOT_COUNT}).`}
        </p>
      ) : !isPlatform &&
        !fieldsReadOnly &&
        !listing.listingFeePaidAt &&
        feeCents > 0 &&
        listing.requestStatus === ListingRequestStatus.approved ? (
        <form action={dashboardPayListingFee} className="mt-3">
          <input type="hidden" name="listingId" value={listing.id} />
          <button
            type="submit"
            className="rounded border border-blue-900/60 bg-blue-950/30 px-3 py-1.5 text-xs text-blue-200 hover:border-blue-700/60"
          >
            Pay {paidListingFeeLabel} listing fee (Stripe)
          </button>
        </form>
      ) : !isPlatform && !listing.listingFeePaidAt && feeCents > 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          Publication fee is due after admin approves this listing. You will be able to pay here once it is
          approved.
        </p>
      ) : !isPlatform && listing.listingFeePaidAt ? (
        <p className="mt-2 text-xs text-emerald-600/90">
          Listing fee paid {listing.listingFeePaidAt.slice(0, 10)}
        </p>
      ) : null}

      {canSubmit ? (
        <DashboardSubmitListingRequestForm
          listingId={listing.id}
          defaultImageUrlsText={imagesDefault}
        />
      ) : listingLocked ? (
        <p className="mt-3 text-xs text-zinc-600">
          This listing can&apos;t be edited. Contact support if you need help.
        </p>
      ) : awaitingAdminReview ? (
        <p className="mt-3 text-xs text-zinc-600">
          This request is with admin — name and price cannot be changed until the listing is approved.
        </p>
      ) : (
        <p className="mt-3 text-xs text-zinc-600">
          Request status: {listing.requestStatus} — contact support if you need changes.
        </p>
      )}
    </div>
  );
}

function ListingCard({
  listing,
  isPlatform,
  paidListingFeeLabel,
  shopSlug,
  r2Configured,
}: {
  listing: DashboardListingRow;
  isPlatform: boolean;
  paidListingFeeLabel: string;
  shopSlug: string;
  r2Configured: boolean;
}) {
  const { dashboardBadge, fieldsReadOnly } = buildListingDerived(listing, shopSlug, isPlatform);

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DashboardListingItemNameForm
          listingId={listing.id}
          catalogProductName={listing.product.name}
          requestItemName={listing.requestItemName}
          readOnly={fieldsReadOnly}
        />
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${dashboardBadge.ringClass}`}
        >
          {dashboardBadge.label}
        </span>
      </div>
      {listing.requestStatus === ListingRequestStatus.rejected ? (
        <>
          <p className="mt-1 text-xs text-zinc-500">
            Rejected — this listing cannot be edited. Contact support if you need help.
          </p>
          {listing.rejectionReasonText ? (
            <p className="mt-1 text-xs leading-snug text-red-200/85">
              <DashboardNoticeBody body={listing.rejectionReasonText} />
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">{requestStatusDescription(listing.requestStatus)}</p>
      )}
      {listing.creatorRemovedFromShopAt ? (
        <p className="mt-1 text-xs text-fuchsia-200/80">
          You removed this listing from your shop on {listing.creatorRemovedFromShopAt.slice(0, 10)}. It no longer
          appears on your public storefront. Contact support if you need it restored.
        </p>
      ) : listing.adminRemovedFromShopAt ? (
        <p className="mt-1 text-xs text-sky-200/75">
          This listing was frozen by the platform and is hidden from your storefront until support clears it.
        </p>
      ) : null}

      <ListingOptionPanel
        listing={listing}
        isPlatform={isPlatform}
        paidListingFeeLabel={paidListingFeeLabel}
        shopSlug={shopSlug}
        r2Configured={r2Configured}
      />
    </li>
  );
}

type TabId =
  | "setup"
  | "shopProfile"
  | "itemGuidelines"
  | "requestListing"
  | "listings"
  | "notifications"
  | "support"
  | "orders";

export function DashboardMainTabs(props: {
  initialTab?: TabId;
  /** Creator shop slug — listing fee tiers (e.g. founder unlimited). */
  shopSlug: string;
  /** Approved listing count / total non-draft listing rows (creator shops). */
  listingTabCounts?: { approved: number; total: number } | null;
  /** Creator onboarding; when set, “Onboarding” is the first tab. */
  setup?: DashboardSetupPanelProps | null;
  /** Full notice history (creators); drives Notifications tab. */
  notifications?: {
    rows: DashboardNoticeRow[];
    unreadCount: number;
  } | null;
  /** Server-rendered support chat (creator shops only). */
  supportChat?: ReactNode | null;
  listingFeePolicySummary: string;
  paidListingFeeLabel: string;
  isPlatform: boolean;
  listings: DashboardListingRow[];
  /** Server-built groups (live / request / removed) — legacy variant stubs merged for display. */
  groupedListingSections: {
    live: GroupedDashboardListing<DashboardListingRow>[];
    request: GroupedDashboardListing<DashboardListingRow>[];
    removed: GroupedDashboardListing<DashboardListingRow>[];
  };
  paidOrders: DashboardPaidOrderRow[];
  /** R2 configured for optional listing photo uploads (creator shops). */
  r2Configured: boolean;
  /** When set, Request listing tab pre-fills from this draft (baseline stub listings only). */
  draftListingRequestPrefill?: DraftListingRequestPrefillPayload | null;
}) {
  const {
    initialTab: initialTabProp,
    shopSlug,
    listingTabCounts = null,
    setup,
    notifications,
    supportChat,
    listingFeePolicySummary,
    paidListingFeeLabel,
    isPlatform,
    listings,
    groupedListingSections,
    paidOrders,
    r2Configured,
    draftListingRequestPrefill = null,
  } = props;

  const hasSetup = setup != null;
  const hasNotifications = Boolean(notifications);
  const canSupport = Boolean(supportChat);
  const [tab, setTab] = useState<TabId>(() => {
    const i = initialTabProp;
    if (hasSetup) {
      if (
        i === "listings" ||
        i === "orders" ||
        i === "setup" ||
        i === "shopProfile" ||
        i === "itemGuidelines" ||
        i === "notifications" ||
        i === "requestListing" ||
        (i === "support" && canSupport)
      ) {
        if (i === "notifications" && !hasNotifications) return "setup";
        if (i === "support" && !canSupport) return "setup";
        return i;
      }
      return "setup";
    }
    if (i === "orders") return "orders";
    if (i === "support" && canSupport) return "support";
    return "listings";
  });

  const baseId = useId();
  const setupTabId = `${baseId}-tab-setup`;
  const setupPanelId = `${baseId}-panel-setup`;
  const shopProfileTabId = `${baseId}-tab-shop-profile`;
  const shopProfilePanelId = `${baseId}-panel-shop-profile`;
  const itemGuidelinesTabId = `${baseId}-tab-item-guidelines`;
  const itemGuidelinesPanelId = `${baseId}-panel-item-guidelines`;
  const requestListingTabId = `${baseId}-tab-request-listing`;
  const requestListingPanelId = `${baseId}-panel-request-listing`;
  const listingsTabId = `${baseId}-tab-listings`;
  const notificationsTabId = `${baseId}-tab-notifications`;
  const notificationsPanelId = `${baseId}-panel-notifications`;
  const ordersTabId = `${baseId}-tab-orders`;
  const supportTabId = `${baseId}-tab-support`;
  const listingsPanelId = `${baseId}-panel-listings`;
  const ordersPanelId = `${baseId}-panel-orders`;
  const supportPanelId = `${baseId}-panel-support`;

  const { live: groupedLive, request: groupedRequest, removed: groupedRemoved } = groupedListingSections;

  const tabBtn = (id: TabId, label: ReactNode, tabId: string, panelId: string) => (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={tab === id}
      aria-controls={panelId}
      tabIndex={tab === id ? 0 : -1}
      onClick={() => setTab(id)}
      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
        tab === id
          ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600"
          : "text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );

  const unreadN = notifications?.unreadCount ?? 0;

  return (
    <section className="mt-8">
      <div
        className="flex flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-950/40 p-1"
        role="tablist"
        aria-label="Shop dashboard"
      >
        {hasSetup && setup ? (
          tabBtn(
            "setup",
            <span className="inline-flex items-center gap-2">
              Onboarding
              {setup.incompleteSetupCount > 0 ? (
                <span className="rounded-full bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-100">
                  {setup.incompleteSetupCount}
                </span>
              ) : null}
            </span>,
            setupTabId,
            setupPanelId,
          )
        ) : null}
        {hasSetup && setup
          ? tabBtn("shopProfile", "Shop profile", shopProfileTabId, shopProfilePanelId)
          : null}
        {hasSetup && setup
          ? tabBtn(
              "itemGuidelines",
              "Item guidelines",
              itemGuidelinesTabId,
              itemGuidelinesPanelId,
            )
          : null}
        {hasSetup && setup
          ? tabBtn("requestListing", "Request listing", requestListingTabId, requestListingPanelId)
          : null}
        {tabBtn(
          "listings",
          listingTabCounts ? (
            <span className="inline-flex items-center gap-2">
              Listings
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-200">
                {listingTabCounts.approved}/{listingTabCounts.total}
              </span>
            </span>
          ) : (
            "Listings"
          ),
          listingsTabId,
          listingsPanelId,
        )}
        {hasNotifications && notifications
          ? tabBtn(
              "notifications",
              <span className="inline-flex items-center gap-2">
                Notifications
                {unreadN > 0 ? (
                  <span className="rounded-full bg-sky-900/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sky-100">
                    {unreadN}
                  </span>
                ) : null}
              </span>,
              notificationsTabId,
              notificationsPanelId,
            )
          : null}
        {canSupport ? tabBtn("support", "Support", supportTabId, supportPanelId) : null}
        {tabBtn("orders", "Recent paid orders", ordersTabId, ordersPanelId)}
      </div>

      {hasSetup && setup ? (
        <div
          id={setupPanelId}
          role="tabpanel"
          aria-labelledby={setupTabId}
          hidden={tab !== "setup"}
          className="pt-6"
        >
          <ShopSetupTabs
            key={setup.setupTabsKey}
            shop={setup.shop}
            steps={setup.steps}
            stripeConnectUnlocked={setup.stripeConnectUnlocked}
            embedded
          />
        </div>
      ) : null}

      {hasSetup && setup ? (
        <div
          id={shopProfilePanelId}
          role="tabpanel"
          aria-labelledby={shopProfileTabId}
          hidden={tab !== "shopProfile"}
          className="pt-6"
        >
          <ShopProfileSetupPanel
            key={setup.setupTabsKey}
            shop={setup.shop}
            profileStepDone={setup.steps.profile}
            r2Configured={setup.r2Configured}
            embedded
          />
        </div>
      ) : null}

      {hasSetup && setup ? (
        <div
          id={itemGuidelinesPanelId}
          role="tabpanel"
          aria-labelledby={itemGuidelinesTabId}
          hidden={tab !== "itemGuidelines"}
          className="pt-6"
        >
          <ShopItemGuidelinesPanel
            key={setup.setupTabsKey}
            acknowledged={setup.itemGuidelinesAcknowledged}
            embedded
          />
        </div>
      ) : null}

      {hasSetup && setup ? (
        <div
          id={requestListingPanelId}
          role="tabpanel"
          aria-labelledby={requestListingTabId}
          hidden={tab !== "requestListing"}
          className="pt-6"
        >
          <ShopFirstListingRequestPanel
            catalogGroups={setup.catalogGroups}
            listingFeePolicySummary={setup.listingFeePolicySummary}
            r2Configured={setup.r2Configured}
            listingPickerDiagnostics={setup.listingPickerDiagnostics}
            draftListingRequestPrefill={draftListingRequestPrefill}
            embedded
          />
        </div>
      ) : null}

      <div
        id={listingsPanelId}
        role="tabpanel"
        aria-labelledby={listingsTabId}
        hidden={tab !== "listings"}
        className="pt-6"
      >
        <p className="text-xs text-zinc-600">
          Set your public price (at least the catalog minimum). {listingFeePolicySummary} After admin links
          Printify and approves, pay the publication fee here if required for your slot — then the listing
          goes live. Platform catalog shop skips the fee.
        </p>

        {groupedLive.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-500/90">Live</h3>
            <p className="mt-1 text-[11px] text-zinc-600">
              Active on your public storefront right now.
            </p>
            <ul className="mt-3 space-y-6">
              {groupedLive.map((g) => (
                <ListingCard
                  key={g.row.id}
                  listing={g.row}
                  isPlatform={isPlatform}
                  paidListingFeeLabel={paidListingFeeLabel}
                  shopSlug={shopSlug}
                  r2Configured={r2Configured}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {groupedRequest.length > 0 ? (
          <div
            className={groupedLive.length > 0 || groupedRemoved.length > 0 ? "mt-10" : "mt-6"}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Listing requests & setup
            </h3>
            <p className="mt-1 text-[11px] text-zinc-600">
              Drafts, submitted requests, and inactive rows — pay fees, set pricing, and track status
              here.
            </p>
            <ul className="mt-3 space-y-6">
              {groupedRequest.map((g) => (
                <ListingCard
                  key={g.row.id}
                  listing={g.row}
                  isPlatform={isPlatform}
                  paidListingFeeLabel={paidListingFeeLabel}
                  shopSlug={shopSlug}
                  r2Configured={r2Configured}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {groupedRemoved.length > 0 ? (
          <div
            className={
              groupedLive.length > 0 || groupedRequest.length > 0 ? "mt-10" : "mt-6"
            }
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-red-400/95">Rejected</h3>
            <p className="mt-1 text-[11px] text-zinc-600">
              You took these off your storefront, or the listing request was rejected. These rows aren&apos;t editable —
              contact support to restore a removed listing or to discuss a rejected request.
            </p>
            <ul className="mt-3 space-y-6">
              {groupedRemoved.map((g) => (
                <ListingCard
                  key={g.row.id}
                  listing={g.row}
                  isPlatform={isPlatform}
                  paidListingFeeLabel={paidListingFeeLabel}
                  shopSlug={shopSlug}
                  r2Configured={r2Configured}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {listings.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">
            No listings yet. Open the <strong className="text-zinc-400">Request listing</strong> tab to choose a
            catalog item, set your price, and upload artwork for admin review.
          </p>
        ) : null}
      </div>

      {hasNotifications && notifications ? (
        <div
          id={notificationsPanelId}
          role="tabpanel"
          aria-labelledby={notificationsTabId}
          hidden={tab !== "notifications"}
          className="pt-6"
        >
          <p className="text-xs text-zinc-600">
            Newest first. Mark as read clears your unread state; messages stay here for your records.
          </p>
          <ul className="mt-4 space-y-3">
            {notifications.rows.map((n) => {
              const isUnread = n.readAt == null;
              return (
                <li
                  key={n.id}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    isUnread
                      ? "border-sky-900/50 bg-sky-950/15 text-sky-100/90"
                      : "border-zinc-800 bg-zinc-950/30 text-zinc-400"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                    <p className="min-w-0 flex-1 leading-snug">
                      <DashboardNoticeBody body={n.body} />
                    </p>
                    {isUnread ? (
                      <form action={dashboardMarkOwnerNoticeRead} className="shrink-0">
                        <input type="hidden" name="noticeId" value={n.id} />
                        <DashboardNoticeMarkReadButton />
                      </form>
                    ) : (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                        Read
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
                    <time dateTime={n.createdAt}>{formatNoticeWhen(n.createdAt)}</time>
                    {n.readAt ? (
                      <span className="text-zinc-600">
                        Read {formatNoticeWhen(n.readAt)}
                      </span>
                    ) : null}
                    <span className="font-mono text-[10px] text-zinc-600">{n.kind}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {notifications.rows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No notifications yet.</p>
          ) : null}
        </div>
      ) : null}

      {canSupport && supportChat ? (
        <div
          id={supportPanelId}
          role="tabpanel"
          aria-labelledby={supportTabId}
          hidden={tab !== "support"}
          className="pt-6"
        >
          {supportChat}
        </div>
      ) : null}

      <div
        id={ordersPanelId}
        role="tabpanel"
        aria-labelledby={ordersTabId}
        hidden={tab !== "orders"}
        className="pt-6"
      >
        <p className="text-xs text-zinc-600">Newest first (up to 20). Line splits are totals for that line.</p>
        <ul className="mt-4 space-y-3">
          {paidOrders.map((o) => (
            <li key={o.id} className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-400">
              <div className="flex justify-between gap-2 text-zinc-300">
                <span>{o.createdAt.slice(0, 19)}Z</span>
                <span>{formatMoney(o.totalCents)}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {o.lines.map((l, i) => (
                  <li key={i}>
                    {l.productName} × {l.quantity} ({formatMoney(l.unitPriceCents * l.quantity)} merch) — shop{" "}
                    {formatMoney(l.shopCutCents)} · platform {formatMoney(l.platformCutCents)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {paidOrders.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">No paid orders for this shop yet.</p>
        ) : null}
      </div>
    </section>
  );
}
