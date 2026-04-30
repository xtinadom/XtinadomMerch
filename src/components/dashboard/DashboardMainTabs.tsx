"use client";

import type { ReactNode } from "react";
import type { Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import type { DashboardMainTabId } from "@/lib/dashboard-main-tab-id";
import type { DashboardSupportChatPayload } from "@/lib/dashboard-scoped-data";
import { DashboardSupportChatPanel } from "@/components/dashboard/DashboardSupportChatPanel";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";
import {
  dashboardCreatorRemoveListingFromShop,
  dashboardPayListingFee,
} from "@/actions/dashboard-marketplace";
import { ListingFeeCardPay } from "@/components/dashboard/ListingFeeCardPay";
import {
  LISTING_FEE_FREE_SLOT_COUNT,
  isFounderUnlimitedFreeListingsShop,
  listingFeeCentsForOrdinal,
  listingFeeFreeSlotCap,
} from "@/lib/marketplace-constants";
import {
  DashboardListingItemNameForm,
  DashboardListingStorefrontBlurbForm,
  DashboardListingSearchKeywordsForm,
  DashboardListingPriceForm,
  DashboardListingSupplementPhotoForm,
  DashboardSubmitListingRequestForm,
  ListingStorefrontCatalogImagesForms,
} from "@/components/dashboard/DashboardListingForms";
import { DemoShopPurchaseButton } from "@/components/dashboard/DemoShopPurchaseButton";
import { ShopProfileSetupPanel } from "@/components/dashboard/ShopProfileSetupPanel";
import {
  ShopSetupTabs,
  type ShopSetupShopPayload,
  type ShopSetupSteps,
} from "@/components/dashboard/ShopSetupTabs";
import { ShopItemGuidelinesPanel } from "@/components/dashboard/ShopItemGuidelinesPanel";
import { ShopFirstListingRequestPanel } from "@/components/dashboard/ShopFirstListingRequestPanel";
import { BugFeedbackPanel } from "@/components/dashboard/BugFeedbackPanel";
import type { DraftListingRequestPrefillPayload } from "@/lib/shop-baseline-draft-prefill";
import type { ShopSetupCatalogGroup } from "@/lib/shop-baseline-catalog";
import { dashboardMarkOwnerNoticeRead } from "@/actions/shop-dashboard-notices";
import { DashboardNoticeMarkReadButton } from "@/components/dashboard/DashboardNoticeMarkReadButton";
import { DashboardNoticeBody } from "@/components/dashboard/DashboardNoticeBody";
import { dashboardListingMinPriceHintCents } from "@/lib/listing-cart-price";
import { expectedShopProfitMerchandiseUnitCents } from "@/lib/marketplace-fee";
import {
  parseListingStorefrontCatalogImageSelection,
  productImageUrlsUnionHero,
} from "@/lib/product-media";
import type { GroupedDashboardListing } from "@/lib/dashboard-legacy-baseline-listing-groups";
import { parseListingPrintifyVariantPrices } from "@/lib/listing-printify-variant-prices";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { ListingsTabExpandSection } from "@/components/dashboard/ListingsTabExpandSection";
import { ListingsPromotedSection } from "@/components/dashboard/ListingsPromotedSection";
import type {
  DashboardPromotionPurchaseRow,
  PopularItemPromotionUi,
  PromotionMonthlySlotUi,
} from "@/components/dashboard/ListingsPromotedSection";

export type DashboardSetupPanelProps = {
  setupTabsKey: string;
  shop: ShopSetupShopPayload;
  itemGuidelinesAcknowledged: boolean;
  catalogGroups: ShopSetupCatalogGroup[];
  steps: ShopSetupSteps;
  stripeConnectUnlocked: boolean;
  incompleteSetupCount: number;
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
  /** Optional one-line pitch on the public PDP (`ShopListing.storefrontItemBlurb`). */
  storefrontItemBlurb: string | null;
  /** Optional shop search hints (`ShopListing.listingSearchKeywords`). */
  listingSearchKeywords: string | null;
  listingFeePaidAt: string | null;
  adminRemovedFromShopAt: string | null;
  creatorRemovedFromShopAt: string | null;
  /** 1-based order by shop creation time (oldest = 1). */
  listingOrdinal: number;
  /** ISO timestamp — used for “Submitted MM/DD” and similar display. */
  updatedAtIso: string;
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
    /** Catalog row — storefront and marketplace browse require this true. */
    active: boolean;
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
    lineDisplayLabel: string;
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

function estimatedUnitProfitCentsForListing(listing: DashboardListingRow): number {
  const variants = getPrintifyVariantsForProduct(listing.product);
  const fallbackVariantId = variants[0]?.id ?? "";
  const variantId =
    listing.listingPrintifyVariantId?.trim() ||
    listing.product.printifyVariantId?.trim() ||
    fallbackVariantId;
  const map = parseListingPrintifyVariantPrices(listing.listingPrintifyVariantPrices);
  const listPriceCents =
    variantId && map?.[variantId] != null ? map[variantId]! : listing.priceCents;
  const goodsServicesUnitCents =
    variantId && listing.goodsServicesUnitCentsByPrintifyVariantId?.[variantId] != null
      ? listing.goodsServicesUnitCentsByPrintifyVariantId[variantId]!
      : 0;
  return expectedShopProfitMerchandiseUnitCents({
    listPriceCents,
    goodsServicesUnitCents,
  });
}

/** UTC calendar date as MM/DD for listing status lines. */
function formatListingCalendarMd(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${mm}/${dd}`;
  } catch {
    return "";
  }
}

function requestStatusDescription(listing: DashboardListingRow): string {
  switch (listing.requestStatus) {
    case ListingRequestStatus.draft:
      return "Draft — finish artwork / URLs and submit when ready.";
    case ListingRequestStatus.submitted: {
      const md = formatListingCalendarMd(listing.updatedAtIso);
      return md ? `Submitted ${md}` : "Submitted";
    }
    case ListingRequestStatus.images_ok:
      return "In review — image check passed; admin is linking Printify. Your listing badge stays In review until approval.";
    case ListingRequestStatus.printify_item_created:
      return "Printify item created — waiting for admin approval.";
    case ListingRequestStatus.approved:
      return "";
    case ListingRequestStatus.rejected:
      return "Rejected — this listing cannot be edited. Contact support if you need help.";
    default:
      return String(listing.requestStatus);
  }
}

function statusBadgeClass(status: ListingRequestStatus, active: boolean): string {
  if (active) return "bg-emerald-950/50 text-emerald-300/90 ring-emerald-800/50";
  switch (status) {
    case ListingRequestStatus.submitted:
    case ListingRequestStatus.images_ok:
    case ListingRequestStatus.printify_item_created:
      return "bg-amber-950/40 text-amber-200/90 ring-amber-800/50";
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
  /** Catalog image toggles (or a single-line note when only one hero image exists). */
  const showCatalogImagePicker = showOwnerSupplementSection && canEditOwnerSupplement;

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
    fieldsReadOnly,
    canSubmit,
    imagesDefault,
    feeCents,
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

      {!isPlatform &&
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
          <p className="mt-3 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
            Stripe is not configured. For local demo pay (no card), add{" "}
            <code className="text-amber-100/90">DEMO_MODE=1</code> or{" "}
            <code className="text-amber-100/90">MOCK_CHECKOUT=1</code> to{" "}
            <code className="text-amber-100/90">.env.local</code> and restart <code className="text-amber-100/90">npm run dev</code>. Or set{" "}
            <code className="text-amber-100/90">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> for real card entry.
          </p>
        ) : (
          <ListingFeeCardPay
            listingId={listing.id}
            paidListingFeeLabel={paidListingFeeLabel}
            stripePublishableKey={stripePublishableKey}
          />
        )
      ) : null}

      {canSubmit ? (
        <DashboardSubmitListingRequestForm
          listingId={listing.id}
          defaultImageUrlsText={imagesDefault}
          feeBlocksSubmit={feeCents > 0 && !listing.listingFeePaidAt}
          paidListingFeeLabel={paidListingFeeLabel}
          listingFeeChargeConsentRequired={feeCents > 0}
        />
      ) : null}
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
  const { fieldsReadOnly, listingLocked, isFreeListingSlot, founderFreeShop, freeSlotCap } =
    buildListingDerived(listing, shopSlug, isPlatform, listingFeeBonusFreeSlots);
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewTitleId = useId();
  const showPreviewButton =
    listing.requestStatus !== ListingRequestStatus.rejected &&
    listing.creatorRemovedFromShopAt == null &&
    listing.adminRemovedFromShopAt == null;
  const showExpandButton = !listingLocked;
  const salePriceLine = !listingLocked ? `Sale price ${formatMoney(listing.priceCents)}` : null;
  const compactSubline = listingLocked
    ? listing.requestStatus === ListingRequestStatus.rejected
      ? "Rejected — this listing cannot be edited."
      : listing.creatorRemovedFromShopAt != null
        ? "Creator removed — this listing will not appear on your storefront."
        : listing.adminRemovedFromShopAt != null
          ? "Frozen — this listing will not appear on your storefront."
          : requestStatusDescription(listing)
    : `Est. profit ${formatMoney(estimatedUnitProfitCentsForListing(listing))}`;

  const freeListingInline =
    !isPlatform && isFreeListingSlot
      ? founderFreeShop
        ? "Free listing (unlimited)."
        : `Free listing (${listing.listingOrdinal} of ${freeSlotCap}).`
      : null;
  const statusLine = requestStatusDescription(listing);
  const compactTitle = (listing.requestItemName?.trim() || listing.product.name).trim() || "Listing";
  const heroUrl = listing.product.imageUrl?.trim() || "";
  const productSlug = listing.product.slug;
  const openFullPath = isPlatform
    ? `/product/${encodeURIComponent(productSlug)}`
    : `/s/${encodeURIComponent(shopSlug)}/product/${encodeURIComponent(productSlug)}`;
  const embedPath = isPlatform
    ? `/embed/product/${encodeURIComponent(productSlug)}`
    : `/embed/product/${encodeURIComponent(productSlug)}?shop=${encodeURIComponent(shopSlug)}`;

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [previewOpen]);

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
            {heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={heroUrl} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-100">{compactTitle}</p>
            {salePriceLine ? <p className="mt-0.5 text-[11px] text-zinc-500">{salePriceLine}</p> : null}
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {compactSubline}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showPreviewButton ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded border border-zinc-700 bg-zinc-900/40 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            >
              Preview
            </button>
          ) : null}
          {showExpandButton ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded border border-zinc-700 bg-zinc-900/40 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            >
              {expanded ? "Close" : fieldsReadOnly ? "View" : "Edit"}
            </button>
          ) : null}
        </div>
      </div>

      {previewOpen ? (
        <div className="store-modal-overlay-scroll fixed inset-0 z-[2500] flex items-start justify-center overflow-y-auto overscroll-contain p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))] sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            aria-label="Close product"
            className="fixed inset-0 bg-black/72 backdrop-blur-lg"
            onClick={() => setPreviewOpen(false)}
          />
          <div
            className="store-dimension-panel store-product-modal-panel animate-store-panel-in relative z-[2501] flex w-full max-h-[min(calc(100dvh-2rem),calc(100svh-2rem))] min-h-0 max-w-3xl flex-col overflow-hidden shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={previewTitleId}
          >
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              aria-label="Close"
              className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-950/90 text-lg leading-none text-zinc-400 shadow-sm backdrop-blur-sm transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-100 sm:right-3 sm:top-3"
            >
              ×
            </button>
            <div className="store-product-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-10 pr-14 sm:px-10 sm:pb-10 sm:pt-6 sm:pr-16">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id={previewTitleId} className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Preview
                </h2>
                <a
                  href={openFullPath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400/90 underline-offset-2 hover:underline"
                >
                  Open full page
                </a>
              </div>
              <iframe
                title={`Item details: ${compactTitle}`}
                src={embedPath}
                className="h-[min(860px,calc(100dvh-8rem))] w-full border-0 bg-zinc-950"
              />
            </div>
          </div>
        </div>
      ) : null}

      {expanded ? (
        <>
          <div className="mt-3 border-t border-zinc-800 pt-3">
            <DashboardListingItemNameForm
              listingId={listing.id}
              catalogProductName={listing.product.name}
              requestItemName={listing.requestItemName}
              readOnly={fieldsReadOnly}
            />
          </div>

          <DashboardListingStorefrontBlurbForm
            listingId={listing.id}
            storefrontItemBlurb={listing.storefrontItemBlurb}
            readOnly={fieldsReadOnly}
          />
          <DashboardListingSearchKeywordsForm
            listingId={listing.id}
            listingSearchKeywords={listing.listingSearchKeywords}
            readOnly={fieldsReadOnly}
          />
          {listing.requestStatus === ListingRequestStatus.rejected ? (
            <details className="mt-1 group">
              <summary className="flex cursor-pointer list-none items-baseline gap-2 text-xs text-zinc-500">
                <span className="min-w-0 flex-1">Rejected — this listing cannot be edited.</span>
                <span
                  className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-600"
                  aria-hidden
                >
                  Details
                  <span className="ml-1 inline-block transition group-open:rotate-180">▾</span>
                </span>
              </summary>
              {listing.rejectionReasonText ? (
                <div className="mt-1 text-xs leading-snug text-red-200/85">
                  <DashboardNoticeBody body={listing.rejectionReasonText} />
                </div>
              ) : (
                <p className="mt-1 text-xs text-zinc-600">No additional rejection details were provided.</p>
              )}
            </details>
          ) : statusLine || freeListingInline ? (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-zinc-500">
              {statusLine ? <span>{statusLine}</span> : null}
              {statusLine && freeListingInline ? (
                <>
                  <span className="text-zinc-600/40" aria-hidden>
                    ·
                  </span>
                  <span className="text-zinc-600">{freeListingInline}</span>
                </>
              ) : freeListingInline ? (
                <span className="text-zinc-600">{freeListingInline}</span>
              ) : null}
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
        </>
      ) : null}
    </li>
  );
}

type TabId = DashboardMainTabId;

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
    if (t === "itemGuidelines" && !showOnboardingTab) t = defaultCreatorTab;

    if (
      t === "listings" ||
      t === "promotions" ||
      t === "orders" ||
      t === "setup" ||
      t === "shopProfile" ||
      (t === "itemGuidelines" && showOnboardingTab) ||
      t === "bugFeedback" ||
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
  if (i === "promotions") return "listings";
  if (i === "support" && canSupport) return "support";
  return "listings";
}

export function DashboardMainTabs(props: {
  initialTab?: TabId;
  /** Creator shop slug — listing fee tiers (e.g. founder unlimited). */
  shopSlug: string;
  /** Creator onboarding; when set, “Onboarding” is the first tab. */
  setup?: DashboardSetupPanelProps | null;
  /** Full notice history (creators); loaded when the Notifications tab is opened. */
  notifications?: {
    rows: DashboardNoticeRow[];
    unreadCount: number;
  } | null;
  /** Unread count from the server when notification rows are not in this payload (other tabs). */
  notificationsUnreadCount?: number;
  /** Staff replies after the creator’s last message — Support tab badge only. */
  supportNewFromStaffCount?: number;
  /** Support thread payload (creator shops); loaded with Support tab or via lazy fetch. */
  supportChat?: DashboardSupportChatPayload | null;
  /** Which tab payloads were included in the initial RSC response (`?dash=`). */
  initialTabDataLoaded: {
    listings: boolean;
    promotions: boolean;
    orders: boolean;
    notifications: boolean;
    support: boolean;
    requestListingCatalog: boolean;
  };
  paidListingFeeLabel: string;
  /** Extra free publication slots from redeemed promo codes (non-founder creator shops). */
  listingFeeBonusFreeSlots: number;
  /** Show self-serve promo redeem UI on the Request listing tab. */
  showListingSlotPromoRedeem: boolean;
  isPlatform: boolean;
  listings: DashboardListingRow[];
  /** Server-built groups (live / request / removed) — legacy variant stubs merged for display. */
  groupedListingSections: {
    live: GroupedDashboardListing<DashboardListingRow>[];
    request: GroupedDashboardListing<DashboardListingRow>[];
    removed: GroupedDashboardListing<DashboardListingRow>[];
  };
  /** Paid promotion boosts (Stripe or mock); null for platform shop. */
  promotions?: {
    purchases: DashboardPromotionPurchaseRow[];
    liveListingPicklist: { id: string; label: string }[];
    mockPromotionCheckout: boolean;
    stripePublishableKey: string | null;
    hotItemPromotion: PromotionMonthlySlotUi;
    topShopPromotion: PromotionMonthlySlotUi;
    popularItemPromotion: PopularItemPromotionUi;
  } | null;
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
  /** When true, show demo paid-order control on Orders tab (local `next dev` + `SHOP_DEMO_PURCHASE_BUTTON=1` only). */
  showDemoPurchaseButton?: boolean;
}) {
  const {
    initialTab: initialTabProp,
    shopSlug,
    setup: initialSetup,
    notifications: initialNotifications,
    notificationsUnreadCount = 0,
    supportNewFromStaffCount = 0,
    supportChat: initialSupportChat,
    paidListingFeeLabel,
    listingFeeBonusFreeSlots,
    showListingSlotPromoRedeem,
    isPlatform,
    listings: initialListings,
    groupedListingSections: initialGroupedListingSections,
    promotions: initialPromotions = null,
    paidOrders: initialPaidOrders,
    r2Configured,
    draftListingRequestPrefill: initialDraftPrefill = null,
    mockListingFeeCheckout,
    shopStripeConnectReadyForCharges,
    stripePublishableKey,
    showDemoPurchaseButton = false,
    initialTabDataLoaded,
  } = props;

  const [loadedFlags, setLoadedFlags] = useState(initialTabDataLoaded);
  const [listings, setListings] = useState(initialListings);
  const [groupedListingSections, setGroupedListingSections] = useState(initialGroupedListingSections);
  const [promotions, setPromotions] = useState(initialPromotions);
  const [paidOrders, setPaidOrders] = useState(initialPaidOrders);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [supportChat, setSupportChat] = useState(initialSupportChat);
  const [setup, setSetup] = useState(initialSetup);
  const [draftListingRequestPrefill, setDraftListingRequestPrefill] = useState(initialDraftPrefill);

  /** RSC can send new props without remounting (e.g. `router.refresh`); re-seed client tab cache. */
  useEffect(() => {
    setLoadedFlags(initialTabDataLoaded);
    setListings(initialListings);
    setGroupedListingSections(initialGroupedListingSections);
    setPromotions(initialPromotions);
    setPaidOrders(initialPaidOrders);
    setNotifications(initialNotifications);
    setSupportChat(initialSupportChat);
    setSetup(initialSetup);
    setDraftListingRequestPrefill(initialDraftPrefill);
  }, [
    initialTabDataLoaded,
    initialListings,
    initialGroupedListingSections,
    initialPromotions,
    initialPaidOrders,
    initialNotifications,
    initialSupportChat,
    initialSetup,
    initialDraftPrefill,
  ]);

  const hasSetup = setup != null;
  const showOnboardingTab = Boolean(setup && setup.incompleteSetupCount > 0);
  /** Notifications tab is always available for creator shops; rows load when the tab is opened. */
  const hasNotifications = !isPlatform ? true : Boolean(notifications);
  const canSupport = !isPlatform;
  const tabOpts = { hasSetup, showOnboardingTab, hasNotifications, canSupport };
  const normalizedInitialTab = normalizeDashboardMainTab(initialTabProp, tabOpts);
  const [didUserPickTab, setDidUserPickTab] = useState(false);
  const [tab, setTab] = useState<TabId>(() =>
    normalizeDashboardMainTab(initialTabProp, tabOpts),
  );
  /** Optimistic tab highlight before RSC finishes; server `key={dashTab}` remounts when `?dash=` navigation completes. */
  const effectiveTab = didUserPickTab ? tab : normalizedInitialTab;

  const router = useRouter();

  const baseId = useId();
  const setupTabId = `${baseId}-tab-setup`;
  const setupPanelId = `${baseId}-panel-setup`;
  const shopProfileTabId = `${baseId}-tab-shop-profile`;
  const shopProfilePanelId = `${baseId}-panel-shop-profile`;
  const itemGuidelinesTabId = `${baseId}-tab-item-guidelines`;
  const itemGuidelinesPanelId = `${baseId}-panel-item-guidelines`;
  const requestListingTabId = `${baseId}-tab-request-listing`;
  const requestListingPanelId = `${baseId}-panel-request-listing`;
  const bugFeedbackTabId = `${baseId}-tab-bug-feedback`;
  const bugFeedbackPanelId = `${baseId}-panel-bug-feedback`;
  const listingsTabId = `${baseId}-tab-listings`;
  const promotionsTabId = `${baseId}-tab-promotions`;
  const notificationsTabId = `${baseId}-tab-notifications`;
  const notificationsPanelId = `${baseId}-panel-notifications`;
  const ordersTabId = `${baseId}-tab-orders`;
  const supportTabId = `${baseId}-tab-support`;
  const listingsPanelId = `${baseId}-panel-listings`;
  const promotionsPanelId = `${baseId}-panel-promotions`;
  const ordersPanelId = `${baseId}-panel-orders`;
  const supportPanelId = `${baseId}-panel-support`;

  const { live: groupedLive, request: groupedRequest, removed: groupedRemoved } = groupedListingSections;

  /**
   * Updates `?dash=` (preserving other query params) so the dashboard RSC loads the same scoped payload
   * as a direct visit — avoids server-action serialization edge cases that left lazy tabs stuck on “Loading…”.
   */
  const navigateToTab = useCallback(
    (id: TabId) => {
      setDidUserPickTab(true);
      setTab(id);
      if (typeof window === "undefined") return;
      const next = new URLSearchParams(window.location.search);
      next.set("dash", id);
      void router.replace(`/dashboard?${next.toString()}`, { scroll: false });
    },
    [router],
  );

  const tabBtn = (id: TabId, label: ReactNode, tabId: string, panelId: string) => (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={effectiveTab === id}
      aria-controls={panelId}
      tabIndex={effectiveTab === id ? 0 : -1}
      onClick={() => navigateToTab(id)}
      className={`rounded-md px-4 py-2 text-sm font-medium transition ${
        effectiveTab === id
          ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600"
          : "text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );

  const unreadN = notifications?.unreadCount ?? notificationsUnreadCount;

  return (
    <section className="mt-8">
      <div
        className="flex flex-col gap-2"
        role="tablist"
        aria-label="Shop dashboard"
      >
        {hasSetup && setup && showOnboardingTab ? (
          <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-950/40 p-1">
            {tabBtn("setup", "Onboarding", setupTabId, setupPanelId)}
            {tabBtn("itemGuidelines", "Shop regulations", itemGuidelinesTabId, itemGuidelinesPanelId)}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-950/40 p-1">
          {hasNotifications
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
          {hasSetup && setup
            ? tabBtn("shopProfile", "Shop profile", shopProfileTabId, shopProfilePanelId)
            : null}
          {hasSetup && setup
            ? tabBtn("requestListing", "Request listing", requestListingTabId, requestListingPanelId)
            : null}
          {tabBtn("listings", "Listings", listingsTabId, listingsPanelId)}
          {!isPlatform ? tabBtn("promotions", "Promotions", promotionsTabId, promotionsPanelId) : null}
          {tabBtn("orders", "Orders", ordersTabId, ordersPanelId)}
          {canSupport
            ? tabBtn(
                "support",
                <span className="inline-flex items-center gap-2">
                  Support
                  {supportNewFromStaffCount > 0 ? (
                    <span className="rounded-full bg-violet-900/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-violet-100">
                      {supportNewFromStaffCount}
                    </span>
                  ) : null}
                </span>,
                supportTabId,
                supportPanelId,
              )
            : null}
          {hasSetup && setup
            ? tabBtn("bugFeedback", "Bug/Feedback", bugFeedbackTabId, bugFeedbackPanelId)
            : null}
        </div>
      </div>

      {hasSetup && setup && showOnboardingTab ? (
        <div
          id={setupPanelId}
          role="tabpanel"
          aria-labelledby={setupTabId}
          hidden={effectiveTab !== "setup"}
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
          hidden={effectiveTab !== "shopProfile"}
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

      {hasSetup && setup && showOnboardingTab ? (
        <div
          id={itemGuidelinesPanelId}
          role="tabpanel"
          aria-labelledby={itemGuidelinesTabId}
          hidden={effectiveTab !== "itemGuidelines"}
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
          hidden={effectiveTab !== "requestListing"}
          className="pt-6"
        >
          {!loadedFlags.requestListingCatalog ? (
            <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
                aria-hidden
              />
              Loading catalog…
            </div>
          ) : (
            <ShopFirstListingRequestPanel
              catalogGroups={setup.catalogGroups}
              r2Configured={setup.r2Configured}
              listingPickerDiagnostics={setup.listingPickerDiagnostics}
              draftListingRequestPrefill={draftListingRequestPrefill}
              publicationFeeLabel={setup.firstListingPublicationFeeLabel}
              stripeConnectReadyForPaidListings={setup.stripeConnectReadyForPaidListings}
              showListingSlotPromoRedeem={showListingSlotPromoRedeem}
              embedded
            />
          )}
        </div>
      ) : null}

      {hasSetup && setup ? (
        <div
          id={bugFeedbackPanelId}
          role="tabpanel"
          aria-labelledby={bugFeedbackTabId}
          hidden={effectiveTab !== "bugFeedback"}
          className="pt-6"
        >
          <BugFeedbackPanel embedded />
        </div>
      ) : null}

      <div
        id={listingsPanelId}
        role="tabpanel"
        aria-labelledby={listingsTabId}
        hidden={effectiveTab !== "listings"}
        className="pt-4"
      >
        {!loadedFlags.listings ? (
          <div className="flex items-center gap-2 py-10 text-sm text-zinc-500">
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
              aria-hidden
            />
            Loading listings…
          </div>
        ) : (
          <>
        {groupedRequest.length > 0 ? (
          <ListingsTabExpandSection
            className="mt-6"
            title="In review & listing setup"
            titleClassName="text-zinc-500"
            badgeCount={groupedRequest.length}
            blurb={
              !isPlatform ? (
                isFounderUnlimitedFreeListingsShop(shopSlug) ? (
                  <>All your listings publish free.</>
                ) : (
                  <>Your first {LISTING_FEE_FREE_SLOT_COUNT} listings are free.</>
                )
              ) : (
                <>Drafts, publication fees, and requests awaiting admin.</>
              )
            }
          >
            <ul className="mt-3 space-y-3">
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
          </ListingsTabExpandSection>
        ) : null}

        {groupedLive.length > 0 ? (
          <ListingsTabExpandSection
            className="mt-6"
            title="Live"
            titleClassName="text-emerald-500/90"
            badgeCount={groupedLive.length}
            blurb="Active on your public storefront right now."
          >
            <ul className="mt-3 space-y-3">
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
          </ListingsTabExpandSection>
        ) : null}

        {groupedRemoved.length > 0 ? (
          <ListingsTabExpandSection
            className="mt-6"
            title="Removed"
            titleClassName="text-red-400/95"
            badgeCount={groupedRemoved.length}
            blurb={
              <>
                Listings that do not (or will not) appear on your storefront.
              </>
            }
          >
            <ul className="mt-3 space-y-3">
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
          </ListingsTabExpandSection>
        ) : null}

        {listings.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">
            No listings yet. Open the <strong className="text-zinc-400">Request listing</strong> tab to choose a
            catalog item, set your price, and upload artwork for admin review.
          </p>
        ) : null}
          </>
        )}
      </div>

      {!isPlatform ? (
        <div
          id={promotionsPanelId}
          role="tabpanel"
          aria-labelledby={promotionsTabId}
          hidden={effectiveTab !== "promotions"}
          className="pt-6"
        >
          {!loadedFlags.promotions ? (
            <div className="flex items-center gap-2 py-10 text-sm text-zinc-500">
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
                aria-hidden
              />
              Loading promotions…
            </div>
          ) : promotions ? (
            <ListingsPromotedSection
              purchases={promotions.purchases}
              liveListingPicklist={promotions.liveListingPicklist}
              mockPromotionCheckout={promotions.mockPromotionCheckout}
              stripePublishableKey={promotions.stripePublishableKey}
              hotItemPromotion={promotions.hotItemPromotion}
              topShopPromotion={promotions.topShopPromotion}
              popularItemPromotion={promotions.popularItemPromotion}
            />
          ) : null}
        </div>
      ) : null}

      {hasNotifications ? (
        <div
          id={notificationsPanelId}
          role="tabpanel"
          aria-labelledby={notificationsTabId}
          hidden={effectiveTab !== "notifications"}
          className="pt-6"
        >
          {!loadedFlags.notifications ? (
            <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
                aria-hidden
              />
              Loading notifications…
            </div>
          ) : notifications ? (
            <>
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
                          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                              Read
                            </span>
                            {n.readAt ? (
                              <span className="text-[11px] text-zinc-600">
                                Read {formatNoticeWhen(n.readAt)}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-[11px] text-zinc-600">
                        <time dateTime={n.createdAt}>{formatNoticeWhen(n.createdAt)}</time>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {notifications.rows.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">No notifications yet.</p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {canSupport ? (
        <div
          id={supportPanelId}
          role="tabpanel"
          aria-labelledby={supportTabId}
          hidden={effectiveTab !== "support"}
          className="pt-6"
        >
          {!loadedFlags.support ? (
            <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
                aria-hidden
              />
              Loading support…
            </div>
          ) : (
            <DashboardSupportChatPanel
              messages={supportChat?.messages ?? []}
              resolvedAtIso={supportChat?.resolvedAtIso ?? null}
            />
          )}
        </div>
      ) : null}

      <div
        id={ordersPanelId}
        role="tabpanel"
        aria-labelledby={ordersTabId}
        hidden={effectiveTab !== "orders"}
        className="pt-6"
      >
        <p className="text-xs text-zinc-600">
          Newest first (up to 20). Each line is merchandise only. Shop Profit is the sum of each line’s sale minus
          goods/services cost and platform fee. Shipping and tips are not included here.
        </p>
        {!loadedFlags.orders ? (
          <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
              aria-hidden
            />
            Loading orders…
          </div>
        ) : (
          <>
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
                        {l.lineDisplayLabel} × {l.quantity}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-[11px] text-zinc-500 tabular-nums">
                        <span className="shrink-0">Sale {formatMoney(l.unitPriceCents * l.quantity)}</span>
                        <span className="shrink-0">
                          Goods/services cost {formatMoney(l.goodsServicesCostCents)}
                        </span>
                        <span className="shrink-0">Platform fee {formatMoney(l.platformCutCents)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div
                  className="flex shrink-0 flex-col items-end gap-1 text-right leading-snug text-zinc-300"
                  title="Merchandise only: for each line, sale − goods/services − platform fee; Shop Profit is the sum. Excludes shipping and tips."
                >
                  <span className="text-blue-400">Shop Profit</span>
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
          </>
        )}
      </div>
    </section>
  );
}
