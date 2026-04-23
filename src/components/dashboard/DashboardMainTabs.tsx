"use client";

import type { ReactNode } from "react";
import type { Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";
import {
  dashboardCreatorRemoveListingFromShop,
  dashboardPayListingFee,
} from "@/actions/dashboard-marketplace";
import { ListingFeeCardPay } from "@/components/dashboard/ListingFeeCardPay";
import {
  isFounderUnlimitedFreeListingsShop,
  listingFeeCentsForOrdinal,
  listingFeeFreeSlotCap,
} from "@/lib/marketplace-constants";
import {
  DashboardListingItemNameForm,
  DashboardListingPriceForm,
  DashboardListingSupplementPhotoForm,
  DashboardSubmitListingRequestForm,
  ListingStorefrontCatalogImagesForms,
} from "@/components/dashboard/DashboardListingForms";
import { ListingSlotPromoRedeemForm } from "@/components/dashboard/ListingSlotPromoRedeemForm";
import { DemoShopPurchaseButton } from "@/components/dashboard/DemoShopPurchaseButton";
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
  /** When set, first listing request from onboarding is charged this publication fee (e.g. "$0.25"). */
  firstListingPublicationFeeLabel: string | null;
  /** When a publication fee applies, Connect must be ready before the first paid listing request. */
  stripeConnectReadyForPaidListings: boolean;
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
  baselineCatalogPickEncoded: string | null;
  /** Per Printify variant id — unit COGS (admin baseline); used for estimated shop profit at list price. */
  goodsServicesUnitCentsByPrintifyVariantId: Record<string, number>;
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
  lines: Array<{
    productName: string;
    quantity: number;
    unitPriceCents: number;
    goodsServicesCostCents: number;
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

/** Paid order timestamps from the server are ISO UTC; show calendar date only as MM/DD/YY. */
function formatPaidOrderDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  } catch {
    return iso;
  }
}

function paidOrderDateTimeAttr(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return iso.slice(0, 10);
  }
}

/** Sum of (sale − goods/services − platform fee) per line — matches the line breakdown above. */
function paidOrderShopProfitCents(o: DashboardPaidOrderRow) {
  return o.lines.reduce((sum, l) => {
    const sale = l.unitPriceCents * l.quantity;
    return sum + (sale - l.goodsServicesCostCents - l.platformCutCents);
  }, 0);
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
      return "Approved — goes live on your storefront once any publication fee for this slot is paid.";
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
  listingFeeBonusFreeSlots: number,
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
  const feeCents = listingFeeCentsForOrdinal(listing.listingOrdinal, shopSlug, listingFeeBonusFreeSlots);
  const isFreeListingSlot = feeCents === 0;
  const founderFreeShop = isFounderUnlimitedFreeListingsShop(shopSlug);
  const freeSlotCap = listingFeeFreeSlotCap(shopSlug, listingFeeBonusFreeSlots);
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
    freeSlotCap,
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
  listingFeeBonusFreeSlots,
  r2Configured,
  shopStripeConnectReadyForCharges,
  stripePublishableKey,
  mockListingFeeCheckout,
  variantLabel,
  stacked,
}: {
  listing: DashboardListingRow;
  isPlatform: boolean;
  paidListingFeeLabel: string;
  shopSlug: string;
  listingFeeBonusFreeSlots: number;
  r2Configured: boolean;
  shopStripeConnectReadyForCharges: boolean;
  stripePublishableKey: string | null;
  mockListingFeeCheckout: boolean;
  /** When set (legacy grouped card), show per-option catalog line. */
  variantLabel?: string;
  /** Second+ option in a legacy group — add top divider. */
  stacked?: boolean;
}) {
  const d = buildListingDerived(listing, shopSlug, isPlatform, listingFeeBonusFreeSlots);
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
    freeSlotCap,
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
        goodsServicesUnitCentsByPrintifyVariantId={listing.goodsServicesUnitCentsByPrintifyVariantId}
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
              founderFreeShop
                ? `Are you sure you want to remove this listing from your shop? You cannot undo this action.`
                : `Are you sure you want to remove this listing from your shop? You cannot undo this action, and all listings after your first ${freeSlotCap} will cost ${paidListingFeeLabel}.`,
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
            : `No publication fee — free listing (${listing.listingOrdinal} of ${freeSlotCap}).`}
        </p>
      ) : !isPlatform &&
        !listing.listingFeePaidAt &&
        feeCents > 0 &&
        listing.creatorRemovedFromShopAt == null &&
        listing.adminRemovedFromShopAt == null &&
        (listing.requestStatus === ListingRequestStatus.draft ||
          listing.requestStatus === ListingRequestStatus.approved ||
          listing.requestStatus === ListingRequestStatus.submitted ||
          listing.requestStatus === ListingRequestStatus.images_ok ||
          listing.requestStatus === ListingRequestStatus.printify_item_created) ? (
        mockListingFeeCheckout ? (
          <form action={dashboardPayListingFee} className="mt-3">
            <input type="hidden" name="listingId" value={listing.id} />
            <button
              type="submit"
              className="rounded border border-blue-900/60 bg-blue-950/30 px-3 py-1.5 text-xs text-blue-200 hover:border-blue-700/60"
            >
              Pay {paidListingFeeLabel} publication fee (mock checkout)
            </button>
          </form>
        ) : !shopStripeConnectReadyForCharges ? (
          <p className="mt-3 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
            A publication fee applies. Finish{" "}
            <Link href="/dashboard?dash=setup" className="text-amber-100 underline-offset-2 hover:underline">
              Stripe Connect
            </Link>{" "}
            on the Onboarding tab (charges and payouts enabled) before you can pay this fee or submit charged listings.
          </p>
        ) : !stripePublishableKey?.trim() ? (
          <p className="mt-3 rounded-lg border border-red-900/45 bg-red-950/25 px-3 py-2 text-xs text-red-200/90">
            Card payments are not configured (missing{" "}
            <code className="text-red-100/80">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>). Contact support.
          </p>
        ) : (
          <ListingFeeCardPay
            listingId={listing.id}
            paidListingFeeLabel={paidListingFeeLabel}
            stripePublishableKey={stripePublishableKey}
          />
        )
      ) : !isPlatform && listing.listingFeePaidAt ? (
        <p className="mt-2 text-xs text-emerald-600/90">
          Listing fee paid {listing.listingFeePaidAt.slice(0, 10)}
        </p>
      ) : null}

      {canSubmit ? (
        <DashboardSubmitListingRequestForm
          listingId={listing.id}
          defaultImageUrlsText={imagesDefault}
          feeBlocksSubmit={feeCents > 0 && !listing.listingFeePaidAt}
          paidListingFeeLabel={paidListingFeeLabel}
          listingFeeChargeConsentRequired={feeCents > 0}
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
  listingFeeBonusFreeSlots,
  r2Configured,
  shopStripeConnectReadyForCharges,
  stripePublishableKey,
  mockListingFeeCheckout,
}: {
  listing: DashboardListingRow;
  isPlatform: boolean;
  paidListingFeeLabel: string;
  shopSlug: string;
  listingFeeBonusFreeSlots: number;
  r2Configured: boolean;
  shopStripeConnectReadyForCharges: boolean;
  stripePublishableKey: string | null;
  mockListingFeeCheckout: boolean;
}) {
  const { dashboardBadge, fieldsReadOnly } = buildListingDerived(
    listing,
    shopSlug,
    isPlatform,
    listingFeeBonusFreeSlots,
  );

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
        listingFeeBonusFreeSlots={listingFeeBonusFreeSlots}
        r2Configured={r2Configured}
        shopStripeConnectReadyForCharges={shopStripeConnectReadyForCharges}
        stripePublishableKey={stripePublishableKey}
        mockListingFeeCheckout={mockListingFeeCheckout}
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

function normalizeDashboardMainTab(
  i: TabId | undefined,
  opts: {
    hasSetup: boolean;
    showOnboardingTab: boolean;
    hasNotifications: boolean;
    canSupport: boolean;
  },
): TabId {
  const { hasSetup, showOnboardingTab, hasNotifications, canSupport } = opts;
  const defaultCreatorTab: TabId = showOnboardingTab ? "setup" : "listings";

  if (hasSetup) {
    let t = i;
    if (t === "setup" && !showOnboardingTab) t = defaultCreatorTab;

    if (
      t === "listings" ||
      t === "orders" ||
      t === "setup" ||
      t === "shopProfile" ||
      t === "itemGuidelines" ||
      t === "notifications" ||
      t === "requestListing" ||
      (t === "support" && canSupport)
    ) {
      if (t === "notifications" && !hasNotifications) return defaultCreatorTab;
      if (t === "support" && !canSupport) return defaultCreatorTab;
      return t;
    }
    return defaultCreatorTab;
  }
  if (i === "orders") return "orders";
  if (i === "support" && canSupport) return "support";
  return "listings";
}

export function DashboardMainTabs(props: {
  initialTab?: TabId;
  /** Creator shop slug — listing fee tiers (e.g. founder unlimited). */
  shopSlug: string;
  /**
   * Listings tab badge: `live` storefront-active rows / `livePlusRequested` (= live + in-progress requests).
   * Rejected and creator-removed rows are excluded (same buckets as the Listings tab sections).
   */
  listingTabCounts?: { live: number; livePlusRequested: number } | null;
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
  /** Extra free publication slots from redeemed promo codes (non-founder creator shops). */
  listingFeeBonusFreeSlots: number;
  /** Show self-serve promo redeem UI on the Listings tab. */
  showListingSlotPromoRedeem: boolean;
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
  /** Server-only mock listing fee pay (MOCK_CHECKOUT=1). */
  mockListingFeeCheckout: boolean;
  /** Connect account ready to accept listing-fee card charges. */
  shopStripeConnectReadyForCharges: boolean;
  /** Stripe.js publishable key for embedded listing fee card pay. */
  stripePublishableKey: string | null;
  /** When true, show a gated demo control on the Orders tab (`SHOP_DEMO_PURCHASE_BUTTON=1`). */
  showDemoPurchaseButton?: boolean;
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
    listingFeeBonusFreeSlots,
    showListingSlotPromoRedeem,
    isPlatform,
    listings,
    groupedListingSections,
    paidOrders,
    r2Configured,
    draftListingRequestPrefill = null,
    mockListingFeeCheckout,
    shopStripeConnectReadyForCharges,
    stripePublishableKey,
    showDemoPurchaseButton = false,
  } = props;

  const hasSetup = setup != null;
  const showOnboardingTab = Boolean(setup && setup.incompleteSetupCount > 0);
  const hasNotifications = Boolean(notifications);
  const canSupport = Boolean(supportChat);
  const tabOpts = { hasSetup, showOnboardingTab, hasNotifications, canSupport };
  const [tab, setTab] = useState<TabId>(() =>
    normalizeDashboardMainTab(initialTabProp, tabOpts),
  );

  useEffect(() => {
    setTab(normalizeDashboardMainTab(initialTabProp, tabOpts));
  }, [initialTabProp, hasSetup, showOnboardingTab, hasNotifications, canSupport]);

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
        {hasSetup && setup && showOnboardingTab ? (
          tabBtn(
            "setup",
            <span className="inline-flex items-center gap-2">
              Onboarding
              <span className="rounded-full bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-100">
                {setup.incompleteSetupCount}
              </span>
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
                {listingTabCounts.live}/{listingTabCounts.livePlusRequested}
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
        {tabBtn("orders", "Orders", ordersTabId, ordersPanelId)}
      </div>

      {hasSetup && setup && showOnboardingTab ? (
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
            r2Configured={setup.r2Configured}
            listingPickerDiagnostics={setup.listingPickerDiagnostics}
            draftListingRequestPrefill={draftListingRequestPrefill}
            publicationFeeLabel={setup.firstListingPublicationFeeLabel}
            stripeConnectReadyForPaidListings={setup.stripeConnectReadyForPaidListings}
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
          Set your public price (at least the catalog minimum). {listingFeePolicySummary} If a publication fee
          applies for your slot, pay it on this tab before you submit a draft for admin review; after approval,
          paid listings go live automatically. Platform catalog shop skips the fee.
        </p>

        {showListingSlotPromoRedeem ? <ListingSlotPromoRedeemForm /> : null}

        {groupedRequest.length > 0 ? (
          <div className="mt-6">
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
                  listingFeeBonusFreeSlots={listingFeeBonusFreeSlots}
                  r2Configured={r2Configured}
                  shopStripeConnectReadyForCharges={shopStripeConnectReadyForCharges}
                  stripePublishableKey={stripePublishableKey}
                  mockListingFeeCheckout={mockListingFeeCheckout}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {groupedLive.length > 0 ? (
          <div
            className={
              groupedRequest.length > 0 || groupedRemoved.length > 0 ? "mt-10" : "mt-6"
            }
          >
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
                  listingFeeBonusFreeSlots={listingFeeBonusFreeSlots}
                  r2Configured={r2Configured}
                  shopStripeConnectReadyForCharges={shopStripeConnectReadyForCharges}
                  stripePublishableKey={stripePublishableKey}
                  mockListingFeeCheckout={mockListingFeeCheckout}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {groupedRemoved.length > 0 ? (
          <div
            className={
              groupedRequest.length > 0 || groupedLive.length > 0 ? "mt-10" : "mt-6"
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
                  listingFeeBonusFreeSlots={listingFeeBonusFreeSlots}
                  r2Configured={r2Configured}
                  shopStripeConnectReadyForCharges={shopStripeConnectReadyForCharges}
                  stripePublishableKey={stripePublishableKey}
                  mockListingFeeCheckout={mockListingFeeCheckout}
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
        <p className="text-xs text-zinc-600">
          Newest first (up to 20). Each line is merchandise only. Shop Profit is the sum of each line’s sale minus
          goods/services cost and platform fee. Shipping and tips are not included here.
        </p>
        {showDemoPurchaseButton ? <DemoShopPurchaseButton /> : null}
        <ul className="mt-4 space-y-3">
          {paidOrders.map((o) => (
            <li key={o.id} className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-400">
              <time
                dateTime={paidOrderDateTimeAttr(o.createdAt)}
                className="block tabular-nums text-zinc-300"
              >
                {formatPaidOrderDate(o.createdAt)}
              </time>
              <div className="mt-2 flex items-start justify-between gap-4">
                <ul className="min-w-0 flex-1 space-y-2 text-zinc-400">
                  {o.lines.map((l, i) => (
                    <li key={i} className="leading-snug">
                      <div className="text-zinc-300">
                        {l.productName} × {l.quantity}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500 tabular-nums">
                        Sale {formatMoney(l.unitPriceCents * l.quantity)} · Goods/services cost{" "}
                        {formatMoney(l.goodsServicesCostCents)} · Platform fee {formatMoney(l.platformCutCents)}
                      </div>
                    </li>
                  ))}
                </ul>
                <div
                  className="flex shrink-0 flex-col items-end gap-1 text-right leading-snug text-zinc-300"
                  title="Merchandise only: for each line, sale − goods/services − platform fee; Shop Profit is the sum. Excludes shipping and tips."
                >
                  <span className="text-zinc-500">Shop Profit</span>
                  <span className="text-[11px] tabular-nums text-zinc-300">
                    {formatMoney(paidOrderShopProfitCents(o))}
                  </span>
                </div>
              </div>
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
