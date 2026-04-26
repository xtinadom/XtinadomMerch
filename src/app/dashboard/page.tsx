import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession, getShopOwnerSessionReadonly } from "@/lib/session";
import { FulfillmentType, ListingRequestStatus, OrderStatus } from "@/generated/prisma/enums";
import {
  LISTING_FEE_CENTS,
  PLATFORM_SHOP_SLUG,
  isFounderUnlimitedFreeListingsShop,
  listingFeeCentsForOrdinal,
} from "@/lib/marketplace-constants";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { shopDemoPurchaseFeatureEnabled } from "@/lib/shop-demo-purchase-feature";
import { getStripe } from "@/lib/stripe";
import { dashboardTryCompleteAccountDeletion } from "@/actions/dashboard-account-danger";
import { logoutShopOwner } from "@/actions/shop-auth";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { DashboardMainTabs } from "@/components/dashboard/DashboardMainTabs";
import { DashboardSupportChatPanel } from "@/components/dashboard/DashboardSupportChatPanel";
import {
  isR2UploadConfigured,
  sanitizeShopListingAdminSecondaryImageUrlForDisplay,
  sanitizeShopListingOwnerSupplementImageUrlForDisplay,
} from "@/lib/r2-upload";
import { ensureBaselineAdminCatalogIfEmpty } from "@/lib/seed-baseline-admin-catalog";
import { baselineGoodsServicesUnitCents } from "@/lib/baseline-goods-services-unit-cents";
import {
  buildShopBaselineCatalogGroups,
  parseBaselinePick,
} from "@/lib/shop-baseline-catalog";
import {
  listingRejectionReasonTextForCard,
  resolveListingRejectionNoticeBody,
} from "@/lib/shop-listing-rejection-notice";
import {
  resolveCatalogPrefillFromBaselinePickEncoded,
  resolveCatalogPrefillFromStubProductSlug,
  type DraftListingRequestPrefillPayload,
} from "@/lib/shop-baseline-draft-prefill";
import {
  buildGroupedListingSectionsForDashboard,
  dashboardListingTabBadgeCounts,
} from "@/lib/dashboard-legacy-baseline-listing-groups";
import {
  canStartStripeConnect,
  computeShopOnboardingSteps,
  countIncompleteOnboardingSteps,
} from "@/lib/shop-onboarding-gate";
import { connectBalanceBlocksDeletion, getStripeConnectBalanceUsdCents } from "@/lib/stripe-connect-balance";
import { shopStripeConnectReadyForListingCharges } from "@/lib/shop-stripe-connect-gate";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

type AdminCatalogRowForDisplay = {
  itemGoodsServicesCostCents: number;
};

/** Orders tab: shop listing title, then admin catalog product name in parentheses. */
function dashboardPaidOrderLineDisplayLabel(line: {
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
function paidOrderLineGoodsServicesDisplayCents(
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
function listingGoodsServicesUnitCentsByPrintifyVariantId(
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

export default async function DashboardPage({ searchParams }: PageProps) {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) redirect("/dashboard/login");

  const sp = await searchParams;
  const connect = typeof sp.connect === "string" ? sp.connect : undefined;
  const connectReason =
    typeof sp.reason === "string" ? sp.reason : Array.isArray(sp.reason) ? sp.reason[0] : undefined;
  const emailVerify =
    typeof sp.emailVerify === "string"
      ? sp.emailVerify
      : Array.isArray(sp.emailVerify)
        ? sp.emailVerify[0]
        : undefined;
  const fee = typeof sp.fee === "string" ? sp.fee : undefined;
  const dashRaw = sp.dash;
  const dashStr =
    typeof dashRaw === "string" ? dashRaw : Array.isArray(dashRaw) ? dashRaw[0] : undefined;
  const delConfirmRaw = sp.delConfirm;
  const delConfirm =
    typeof delConfirmRaw === "string"
      ? delConfirmRaw
      : Array.isArray(delConfirmRaw)
        ? delConfirmRaw[0]
        : undefined;

  const user = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    include: {
      shop: {
        include: {
          listings: {
            orderBy: { updatedAt: "desc" },
            include: { product: true },
          },
        },
      },
    },
  });
  if (!user) redirect("/dashboard/login");

  let shop = user.shop;
  if (connect === "return" && shop.stripeConnectAccountId) {
    try {
      const stripe = getStripe();
      const acct = await stripe.accounts.retrieve(shop.stripeConnectAccountId);
      await prisma.shop.update({
        where: { id: shop.id },
        data: {
          connectChargesEnabled: acct.charges_enabled ?? false,
          payoutsEnabled: acct.payouts_enabled ?? false,
        },
      });
      shop = await prisma.shop.findUniqueOrThrow({
        where: { id: shop.id },
        include: {
          listings: {
            orderBy: { updatedAt: "desc" },
            include: { product: true },
          },
        },
      });
    } catch (e) {
      console.error("[dashboard] Stripe Connect refresh failed", e);
    }
  }

  await syncFreeListingFeeWaivers(shop.id);
  shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shop.id },
    include: {
      listings: {
        orderBy: { updatedAt: "desc" },
        include: { product: true },
      },
    },
  });

  const paidOrders = await prisma.order.findMany({
    where: { shopId: shop.id, status: OrderStatus.paid },
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

  const isPlatform = shop.slug === PLATFORM_SHOP_SLUG;
  const showDemoPurchaseButton = !isPlatform && shopDemoPurchaseFeatureEnabled();
  const shopStripeConnectReadyForCharges = shopStripeConnectReadyForListingCharges(shop);
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;
  const mockListingFeeCheckout = !isPlatform && isMockCheckoutEnabled();
  const bonusListingSlots = shop.listingFeeBonusFreeSlots ?? 0;
  const paidListingFeeLabel = formatMoney(LISTING_FEE_CENTS);
  const submittedRequestCount = shop.listings.filter(
    (l) => l.requestStatus !== ListingRequestStatus.draft,
  ).length;
  const firstListingPublicationFeeCents = listingFeeCentsForOrdinal(
    submittedRequestCount + 1,
    shop.slug,
    bonusListingSlots,
  );
  const firstListingPublicationFeeLabel =
    firstListingPublicationFeeCents > 0 ? formatMoney(firstListingPublicationFeeCents) : null;

  const listingOrdinalById = (() => {
    const ordered = [...shop.listings].sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
    );
    return new Map(ordered.map((l, i) => [l.id, i + 1]));
  })();

  if (!isPlatform) {
    await ensureBaselineAdminCatalogIfEmpty(prisma);
  }

  const adminCatalogRows = !isPlatform
    ? await prisma.adminCatalogItem.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          itemExampleListingUrl: true,
          itemMinPriceCents: true,
          itemGoodsServicesCostCents: true,
          itemImageRequirementLabel: true,
          itemPrintAreaWidthPx: true,
          itemPrintAreaHeightPx: true,
          itemMinArtworkDpi: true,
        },
      })
    : [];

  const catalogGroups = !isPlatform ? buildShopBaselineCatalogGroups(adminCatalogRows) : [];

  const adminCatalogById = new Map<string, AdminCatalogRowForDisplay>(
    adminCatalogRows.map((r) => [r.id, { itemGoodsServicesCostCents: r.itemGoodsServicesCostCents }]),
  );

  const draftListingForRequestPrefill = !isPlatform
    ? shop.listings.find(
        (l) =>
          l.requestStatus === ListingRequestStatus.draft &&
          !l.active &&
          l.creatorRemovedFromShopAt == null &&
          l.adminRemovedFromShopAt == null,
      )
    : null;

  let draftListingRequestPrefill: DraftListingRequestPrefillPayload | null = null;
  if (draftListingForRequestPrefill && adminCatalogRows.length > 0) {
    const encoded = draftListingForRequestPrefill.baselineCatalogPickEncoded?.trim();
    const fromEncoded = encoded
      ? resolveCatalogPrefillFromBaselinePickEncoded(
          encoded,
          draftListingForRequestPrefill.priceCents,
          draftListingForRequestPrefill.requestItemName,
          adminCatalogRows,
        )
      : null;
    const resolved =
      fromEncoded ??
      resolveCatalogPrefillFromStubProductSlug(
        shop.id,
        draftListingForRequestPrefill.product.slug,
        draftListingForRequestPrefill.priceCents,
        draftListingForRequestPrefill.requestItemName,
        adminCatalogRows,
      );
    if (resolved) {
      draftListingRequestPrefill = {
        listingId: draftListingForRequestPrefill.id,
        ...resolved,
      };
    }
  }

  const allOwnerNotices = !isPlatform
    ? await prisma.shopOwnerNotice.findMany({
        where: { shopId: shop.id },
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
      })
    : [];

  const unreadNoticeCount = allOwnerNotices.filter((n) => n.readAt == null).length;

  const setupSteps = !isPlatform
    ? computeShopOnboardingSteps({
        displayName: shop.displayName,
        itemGuidelinesAcknowledgedAt: shop.itemGuidelinesAcknowledgedAt,
        emailVerifiedAt: user.emailVerifiedAt,
        listings: shop.listings.map((l) => ({
          requestStatus: l.requestStatus,
          active: l.active,
        })),
        connectChargesEnabled: shop.connectChargesEnabled,
        payoutsEnabled: shop.payoutsEnabled,
      })
    : {
        profile: true,
        guidelines: true,
        emailVerified: true,
        listing: true,
        stripe: true,
      };

  const stripeConnectUnlocked = !isPlatform && canStartStripeConnect(setupSteps);
  const incompleteSetupCount = !isPlatform ? countIncompleteOnboardingSteps(setupSteps) : 0;

  const setupTabsKey = `setup-${setupSteps.stripe}-${setupSteps.profile}-${setupSteps.guidelines}-${setupSteps.emailVerified}-${setupSteps.listing}-${Boolean(shop.itemGuidelinesAcknowledgedAt)}-${Boolean(user.emailVerifiedAt)}`;

  const dashTab:
    | "setup"
    | "shopProfile"
    | "itemGuidelines"
    | "requestListing"
    | "listings"
    | "notifications"
    | "support"
    | "orders" = isPlatform
    ? dashStr === "orders"
      ? "orders"
      : "listings"
    : dashStr === "listings" ||
        dashStr === "orders" ||
        dashStr === "setup" ||
        dashStr === "shopProfile" ||
        dashStr === "itemGuidelines" ||
        dashStr === "notifications" ||
        dashStr === "requestListing" ||
        dashStr === "support"
      ? dashStr === "setup" && incompleteSetupCount === 0
        ? "listings"
        : dashStr
      : incompleteSetupCount > 0
        ? "setup"
        : "listings";

  const supportThreadRow = !isPlatform
    ? await prisma.supportThread.findUnique({
        where: { shopId: shop.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  const supportChatPanel = !isPlatform ? (
    <DashboardSupportChatPanel
      messages={
        supportThreadRow?.messages.map((m) => ({
          id: m.id,
          authorRole: m.authorRole as "creator" | "admin",
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })) ?? []
      }
      resolvedAtIso={supportThreadRow?.resolvedAt?.toISOString() ?? null}
    />
  ) : null;

  const listingRows = shop.listings.map((listing) => {
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
        shop.id,
        listing.id,
      ),
      ownerSupplementImageUrl: sanitizeShopListingOwnerSupplementImageUrlForDisplay(
        listing.ownerSupplementImageUrl,
        shop.id,
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
      listingFeePaidAt: listing.listingFeePaidAt?.toISOString() ?? null,
      adminRemovedFromShopAt: listing.adminRemovedFromShopAt?.toISOString() ?? null,
      creatorRemovedFromShopAt: listing.creatorRemovedFromShopAt?.toISOString() ?? null,
      listingOrdinal: listingOrdinalById.get(listing.id) ?? 1,
      updatedAtIso: listing.updatedAt.toISOString(),
      rejectionReasonText,
      product: {
        name: listing.product.name,
        slug: listing.product.slug,
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

  const groupedListingSections = buildGroupedListingSectionsForDashboard(
    shop.id,
    listingRows,
    adminCatalogRows,
  );

  const listingTabCounts = !isPlatform ? dashboardListingTabBadgeCounts(listingRows) : null;

  const stripeConnectBalance =
    !isPlatform && shop.accountDeletionEmailConfirmedAt != null
      ? await getStripeConnectBalanceUsdCents(shop.stripeConnectAccountId)
      : null;

  if (
    !isPlatform &&
    shop.accountDeletionRequestedAt != null &&
    shop.accountDeletionEmailConfirmedAt != null &&
    !connectBalanceBlocksDeletion(stripeConnectBalance)
  ) {
    const r = await dashboardTryCompleteAccountDeletion();
    if (r.ok) {
      const session = await getShopOwnerSession();
      session.destroy();
      redirect("/?accountDeleted=1");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[868px] flex-col px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Shop dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {shop.displayName}{" "}
            <span className="font-mono text-zinc-600">/s/{shop.slug}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/s/${shop.slug}`}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
          >
            View storefront
          </Link>
          <form action={logoutShopOwner}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-600"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {fee === "ok" ? (
        <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">
          Listing fee payment received (or mock checkout). You can continue with your listing workflow.
        </p>
      ) : null}
      {fee === "cancel" ? (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90">
          Listing fee checkout was cancelled.
        </p>
      ) : null}
      {fee === "err" ? (
        <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200/90">
          {connectReason === "listing_fee_use_card_on_listings_tab"
            ? "Use the Pay button on the Listings tab to enter your card. Listing fees are charged immediately in the dashboard (the old checkout redirect is no longer used)."
            : connectReason === "no_app_url"
              ? "Listing fee payment could not start because the app base URL is not configured on the server."
              : connectReason === "stripe"
                ? "Stripe returned an error while starting listing fee checkout. Try again or contact support."
                : "Something went wrong with the listing fee payment. Open the Listings tab and try paying again, or contact support."}
        </p>
      ) : null}

      {!isPlatform && emailVerify === "ok" ? (
        <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">
          Your email address is verified.
        </p>
      ) : null}
      {!isPlatform && emailVerify && emailVerify !== "ok" ? (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90">
          Email verification link was invalid or expired. Use{" "}
          <strong className="text-amber-100/90">Resend verification email</strong> on the Onboarding tab.
        </p>
      ) : null}
      {!isPlatform && delConfirm === "ok" ? (
        <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">
          Account deletion email confirmed. Your stored photos and listing media for this step have been removed. When
          your Stripe Connect balance is zero, opening the shop dashboard again removes the account automatically.
        </p>
      ) : null}
      {!isPlatform && delConfirm === "purgeFailed" ? (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90">
          Your deletion email was confirmed, but we could not finish clearing your stored images from our servers. Try the
          link again from email, reload this page later, or contact support.
        </p>
      ) : null}
      {!isPlatform && delConfirm && delConfirm !== "ok" && delConfirm !== "purgeFailed" ? (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90">
          {delConfirm === "expired"
            ? "That account deletion link has expired. Request deletion again from the Shop profile tab to receive a new email."
            : delConfirm === "missing"
              ? "That account deletion link was missing a token. Open the full link from your latest email, or request deletion again."
              : "That account deletion link is invalid. Request a new one from the Shop profile tab if you still want to delete your account."}
        </p>
      ) : null}
      {!isPlatform && connect === "err" && connectReason === "onboarding_incomplete" ? (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90">
          Complete onboarding (shop profile, item guidelines, verify email, and a listing request) before connecting
          Stripe.
        </p>
      ) : null}

      {isPlatform ? (
        <p className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-500">
          You are signed in as the platform catalog shop owner. Marketplace Connect and per-listing
          fees do not apply to this account.
        </p>
      ) : null}

      <DashboardMainTabs
        initialTab={dashTab}
        shopSlug={shop.slug}
        supportChat={supportChatPanel}
        draftListingRequestPrefill={draftListingRequestPrefill}
        groupedListingSections={groupedListingSections}
        listingTabCounts={listingTabCounts}
        listingFeeBonusFreeSlots={bonusListingSlots}
        showListingSlotPromoRedeem={
          !isPlatform && !isFounderUnlimitedFreeListingsShop(shop.slug)
        }
        setup={
          !isPlatform
            ? {
                setupTabsKey,
                shop: {
                  shopSlug: shop.slug,
                  displayName: shop.displayName,
                  profileImageUrl: shop.profileImageUrl,
                  welcomeMessage: shop.welcomeMessage,
                  socialLinks: shop.socialLinks,
                  stripeConnectAccountId: shop.stripeConnectAccountId,
                  connectChargesEnabled: shop.connectChargesEnabled,
                  payoutsEnabled: shop.payoutsEnabled,
                  accountDeletionRequestedAt: shop.accountDeletionRequestedAt?.toISOString() ?? null,
                  accountDeletionEmailConfirmedAt:
                    shop.accountDeletionEmailConfirmedAt?.toISOString() ?? null,
                  stripeConnectBalance,
                },
                itemGuidelinesAcknowledged: shop.itemGuidelinesAcknowledgedAt != null,
                catalogGroups: catalogGroups,
                steps: setupSteps,
                stripeConnectUnlocked,
                incompleteSetupCount,
                r2Configured: isR2UploadConfigured(),
                listingPickerDiagnostics: {
                  adminCatalogItemCount: adminCatalogRows.length,
                },
                firstListingPublicationFeeLabel,
                stripeConnectReadyForPaidListings: shopStripeConnectReadyForCharges,
              }
            : null
        }
        paidListingFeeLabel={paidListingFeeLabel}
        isPlatform={isPlatform}
        r2Configured={isR2UploadConfigured()}
        mockListingFeeCheckout={mockListingFeeCheckout}
        shopStripeConnectReadyForCharges={shopStripeConnectReadyForCharges}
        stripePublishableKey={stripePublishableKey}
        showDemoPurchaseButton={showDemoPurchaseButton}
        listings={listingRows}
        paidOrders={paidOrders.map((o) => ({
          id: o.id,
          createdAt: o.createdAt.toISOString(),
          lines: o.lines.map((l) => ({
            lineDisplayLabel: dashboardPaidOrderLineDisplayLabel(l),
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            goodsServicesCostCents: paidOrderLineGoodsServicesDisplayCents(
              l,
              adminCatalogById,
            ),
            platformCutCents: l.platformCutCents,
            shopCutCents: l.shopCutCents,
          })),
        }))}
        notifications={
          !isPlatform
            ? {
                rows: allOwnerNotices.map((n) => ({
                  id: n.id,
                  body: n.body,
                  kind: n.kind,
                  createdAt: n.createdAt.toISOString(),
                  readAt: n.readAt?.toISOString() ?? null,
                })),
                unreadCount: unreadNoticeCount,
              }
            : null
        }
      />

      <p className="mt-10 text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Platform home
        </Link>
      </p>

      <SiteLegalFooter />
    </main>
  );
}
