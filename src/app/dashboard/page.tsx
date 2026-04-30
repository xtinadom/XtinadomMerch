import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession, getShopOwnerSessionReadonly } from "@/lib/session";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import {
  LISTING_FEE_CENTS,
  PLATFORM_SHOP_SLUG,
  isFounderUnlimitedFreeListingsShop,
  listingFeeCentsForOrdinal,
} from "@/lib/marketplace-constants";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { shopDemoPurchaseFeatureEnabled } from "@/lib/shop-demo-purchase-feature";
import { getStripe, isStripeSecretConfigured } from "@/lib/stripe";
import { dashboardTryCompleteAccountDeletion } from "@/actions/dashboard-account-danger";
import { logoutShopOwner } from "@/actions/shop-auth";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { DashboardMainTabs } from "@/components/dashboard/DashboardMainTabs";
import { isR2UploadConfigured } from "@/lib/r2-upload";
import {
  formatMoneyServer as formatMoney,
} from "@/lib/dashboard-payload-helpers";
import {
  loadBadgeCounts,
  loadDashboardScopedChunks,
  scopesForInitialTab,
} from "@/lib/dashboard-scoped-data";
import {
  canStartStripeConnect,
  computeShopOnboardingSteps,
  countIncompleteOnboardingSteps,
} from "@/lib/shop-onboarding-gate";
import { connectBalanceBlocksDeletion, getStripeConnectBalanceUsdCents } from "@/lib/stripe-connect-balance";
import { shopStripeConnectReadyForListingCharges } from "@/lib/shop-stripe-connect-gate";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import { rethrowNextNavigationError } from "@/lib/next-navigation-errors";
import { dashboardTabParamToId } from "@/lib/dashboard-dash-query";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Serialize current dashboard query for tab `Link` hrefs; `dash` is set per tab on the client. */
function dashboardSearchParamsPreserveDash(
  sp: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp)) {
    if (key === "dash") continue;
    if (raw === undefined) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const v of values) {
      if (typeof v === "string" && v.length > 0) p.append(key, v);
    }
  }
  return p.toString();
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
  const promo = typeof sp.promo === "string" ? sp.promo : undefined;
  const promoErr =
    typeof sp.promoErr === "string"
      ? sp.promoErr
      : Array.isArray(sp.promoErr)
        ? sp.promoErr[0]
        : undefined;
  const dashRaw = sp.dash;
  const dashStr = dashboardTabParamToId(
    typeof dashRaw === "string" ? dashRaw : Array.isArray(dashRaw) ? dashRaw[0] : undefined,
  );
  const delConfirmRaw = sp.delConfirm;
  const delConfirm =
    typeof delConfirmRaw === "string"
      ? delConfirmRaw
      : Array.isArray(delConfirmRaw)
        ? delConfirmRaw[0]
        : undefined;

  try {
  const MINIMAL_LISTING_SELECT = {
    id: true,
    active: true,
    requestStatus: true,
    creatorRemovedFromShopAt: true,
    adminRemovedFromShopAt: true,
    createdAt: true,
  } as const;

  const user = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    include: {
      shop: {
        include: {
          listings: {
            orderBy: { updatedAt: "desc" },
            select: MINIMAL_LISTING_SELECT,
          },
        },
      },
    },
  });
  if (!user) redirect("/dashboard/login");

  let shop = user.shop;
  const listingsMinimalInclude = {
    orderBy: { updatedAt: "desc" as const },
    select: MINIMAL_LISTING_SELECT,
  };

  if (connect === "return" && shop.stripeConnectAccountId && isStripeSecretConfigured()) {
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
        include: { listings: listingsMinimalInclude },
      });
    } catch (e) {
      console.error("[dashboard] Stripe Connect refresh failed", e);
    }
  }

  await syncFreeListingFeeWaivers(shop.id);
  shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shop.id },
    include: { listings: listingsMinimalInclude },
  });

  const isPlatform = shop.slug === PLATFORM_SHOP_SLUG;

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

  const incompleteSetupCount = !isPlatform ? countIncompleteOnboardingSteps(setupSteps) : 0;

  const dashTab:
    | "setup"
    | "shopProfile"
    | "itemGuidelines"
    | "requestListing"
    | "bugFeedback"
    | "listings"
    | "promotions"
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
        dashStr === "promotions" ||
        dashStr === "notifications" ||
        dashStr === "requestListing" ||
        dashStr === "bugFeedback" ||
        dashStr === "support"
      ? dashStr === "setup" && incompleteSetupCount === 0
        ? "listings"
        : dashStr === "itemGuidelines" && incompleteSetupCount === 0
          ? "listings"
          : dashStr
      : incompleteSetupCount > 0
        ? "setup"
        : "listings";

  const scopes = scopesForInitialTab(dashTab, isPlatform);

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

  const [badgeCounts, chunks] = await Promise.all([
    loadBadgeCounts(shop.id, isPlatform),
    loadDashboardScopedChunks(shop.id, isPlatform, scopes),
  ]);

  const listingRows = chunks.listingRows;
  const groupedListingSections = chunks.groupedListingSections;
  const promotionsPayload = chunks.promotionsPayload;
  const paidOrders = chunks.paidOrders;
  const notificationsPayload = chunks.notifications;
  const supportChatPayload = chunks.supportChat;
  const rc = chunks.requestListingCatalog;

  const notificationsUnreadCount = badgeCounts.notificationsUnread;
  const supportNewFromStaffCount = badgeCounts.supportNewFromStaff;

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

  const catalogGroups = !isPlatform ? (rc?.catalogGroups ?? []) : [];
  const draftListingRequestPrefill = !isPlatform ? (rc?.draftListingRequestPrefill ?? null) : null;

  const stripeConnectUnlocked = !isPlatform && canStartStripeConnect(setupSteps);

  const setupTabsKey = `setup-${setupSteps.stripe}-${setupSteps.profile}-${setupSteps.guidelines}-${setupSteps.emailVerified}-${setupSteps.listing}-${Boolean(shop.itemGuidelinesAcknowledgedAt)}-${Boolean(user.emailVerifiedAt)}`;

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
      {promo === "ok" ? (
        <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">
          Promotion purchase recorded (mock checkout when enabled).
        </p>
      ) : null}
      {promo === "err" ? (
        <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200/90">
          {promoErr === "mock_only"
            ? "Mock promotion pay is only available when mock checkout is enabled on the server."
            : promoErr === "hot_item_policy"
              ? "That promotion could not be recorded (Hot item / Top shop periods may be fully booked). Refresh and try again, or contact support."
              : "Something went wrong recording the promotion. Try again or contact support."}
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
          Complete onboarding (shop profile, shop regulations, verify email, and a listing request) before connecting
          Stripe.
        </p>
      ) : null}

      {isPlatform ? (
        <p className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-500">
          You are signed in as the platform catalog shop owner. Marketplace Connect and per-listing
          fees do not apply to this account. Paid listing promotions are only available on creator shop
          dashboards (your own storefront slug), not on this catalog account.
        </p>
      ) : null}

      <DashboardMainTabs
        key={dashTab}
        initialTab={dashTab}
        dashboardQueryPreserve={dashboardSearchParamsPreserveDash(sp)}
        shopSlug={shop.slug}
        supportNewFromStaffCount={supportNewFromStaffCount}
        supportChat={supportChatPayload}
        draftListingRequestPrefill={draftListingRequestPrefill}
        groupedListingSections={groupedListingSections}
        promotions={promotionsPayload}
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
                  listedOnShopsBrowse: shop.listedOnShopsBrowse,
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
                  adminCatalogItemCount: rc?.adminCatalogItemCount ?? 0,
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
        paidOrders={paidOrders}
        notifications={!isPlatform ? notificationsPayload : null}
        notificationsUnreadCount={!isPlatform ? notificationsUnreadCount : 0}
        initialTabDataLoaded={{
          listings: scopes.includes("listingsBody"),
          promotions: scopes.includes("promotionsBody"),
          orders: scopes.includes("ordersBody"),
          notifications: scopes.includes("notificationsBody"),
          support: scopes.includes("supportBody"),
          requestListingCatalog: scopes.includes("requestListingCatalog"),
        }}
      />

      <p className="mt-10 text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Platform home
        </Link>
      </p>

      <SiteLegalFooter />
    </main>
  );
  } catch (e) {
    rethrowNextNavigationError(e);
    return <ShopDataLoadError cause={e} />;
  }
}
