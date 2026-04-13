import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSessionReadonly } from "@/lib/session";
import { OrderStatus } from "@/generated/prisma/enums";
import {
  LISTING_FEE_CENTS,
  LISTING_FEE_FREE_SLOT_COUNT,
  PLATFORM_SHOP_SLUG,
} from "@/lib/marketplace-constants";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { getStripe } from "@/lib/stripe";
import { logoutShopOwner } from "@/actions/shop-auth";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { ShopSetupTabs } from "@/components/dashboard/ShopSetupTabs";
import { DashboardMainTabs } from "@/components/dashboard/DashboardMainTabs";
import { isR2UploadConfigured } from "@/lib/r2-upload";
import { buildShopBaselineCatalogGroups } from "@/lib/shop-baseline-catalog";
import { parseShopSocialLinksJson } from "@/lib/shop-social-links";

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

export default async function DashboardPage({ searchParams }: PageProps) {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) redirect("/dashboard/login");

  const sp = await searchParams;
  const connect = typeof sp.connect === "string" ? sp.connect : undefined;
  const fee = typeof sp.fee === "string" ? sp.fee : undefined;
  const dashTab =
    typeof sp.dash === "string" && sp.dash === "orders" ? ("orders" as const) : ("listings" as const);

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
      totalCents: true,
      lines: {
        select: {
          productName: true,
          quantity: true,
          unitPriceCents: true,
          platformCutCents: true,
          shopCutCents: true,
        },
      },
    },
  });

  const isPlatform = shop.slug === PLATFORM_SHOP_SLUG;
  const listingFeePolicySummary = `Your first ${LISTING_FEE_FREE_SLOT_COUNT} listings are free. Each additional listing costs ${formatMoney(LISTING_FEE_CENTS)} to publish.`;
  const paidListingFeeLabel = formatMoney(LISTING_FEE_CENTS);

  const listingOrdinalById = (() => {
    const ordered = [...shop.listings].sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
    );
    return new Map(ordered.map((l, i) => [l.id, i + 1]));
  })();

  const adminCatalogRows = !isPlatform
    ? await prisma.adminCatalogItem.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          variants: true,
          itemExampleListingUrl: true,
          itemMinPriceCents: true,
        },
      })
    : [];

  const catalogGroups = !isPlatform ? buildShopBaselineCatalogGroups(adminCatalogRows) : [];

  const socialParsed = parseShopSocialLinksJson(shop.socialLinks);
  const setupSteps = !isPlatform
    ? {
        stripe: shop.connectChargesEnabled && shop.payoutsEnabled,
        profile: Boolean(
          shop.profileImageUrl ||
            (shop.welcomeMessage?.trim().length ?? 0) > 0 ||
            Object.keys(socialParsed).length > 0,
        ),
        listing: shop.listings.some(
          (l) =>
            l.requestStatus === "submitted" ||
            l.requestStatus === "approved" ||
            l.active,
        ),
      }
    : { stripe: true, profile: true, listing: true };

  const setupTabsKey = `setup-${setupSteps.stripe}-${setupSteps.profile}-${setupSteps.listing}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-12">
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

      {!isPlatform ? (
        <ShopSetupTabs
          key={setupTabsKey}
          shop={{
            displayName: shop.displayName,
            profileImageUrl: shop.profileImageUrl,
            welcomeMessage: shop.welcomeMessage,
            socialLinks: shop.socialLinks,
            stripeConnectAccountId: shop.stripeConnectAccountId,
            connectChargesEnabled: shop.connectChargesEnabled,
            payoutsEnabled: shop.payoutsEnabled,
          }}
          catalogGroups={catalogGroups}
          steps={setupSteps}
          listingFeePolicySummary={listingFeePolicySummary}
          r2Configured={isR2UploadConfigured()}
          listingPickerDiagnostics={{
            adminCatalogItemCount: adminCatalogRows.length,
          }}
        />
      ) : (
        <p className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-500">
          You are signed in as the platform catalog shop owner. Marketplace Connect and per-listing
          fees do not apply to this account.
        </p>
      )}

      <DashboardMainTabs
        initialTab={dashTab}
        listingFeePolicySummary={listingFeePolicySummary}
        paidListingFeeLabel={paidListingFeeLabel}
        isPlatform={isPlatform}
        listings={shop.listings.map((listing) => ({
          id: listing.id,
          active: listing.active,
          requestStatus: listing.requestStatus,
          priceCents: listing.priceCents,
          requestImages: listing.requestImages,
          listingFeePaidAt: listing.listingFeePaidAt?.toISOString() ?? null,
          listingOrdinal: listingOrdinalById.get(listing.id) ?? 1,
          product: {
            name: listing.product.name,
            slug: listing.product.slug,
            minPriceCents: listing.product.minPriceCents,
            priceCents: listing.product.priceCents,
          },
        }))}
        paidOrders={paidOrders.map((o) => ({
          id: o.id,
          createdAt: o.createdAt.toISOString(),
          totalCents: o.totalCents,
          lines: o.lines,
        }))}
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
