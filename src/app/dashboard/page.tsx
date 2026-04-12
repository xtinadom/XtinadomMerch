import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSessionReadonly } from "@/lib/session";
import {
  OrderStatus,
  ListingRequestStatus,
  FulfillmentType,
} from "@/generated/prisma/enums";
import {
  LISTING_FEE_CENTS,
  PLATFORM_SHOP_SLUG,
} from "@/lib/marketplace-constants";
import { getStripe } from "@/lib/stripe";
import { logoutShopOwner } from "@/actions/shop-auth";
import { dashboardPayListingFee } from "@/actions/dashboard-marketplace";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { ShopSetupTabs } from "@/components/dashboard/ShopSetupTabs";
import {
  DashboardListingPriceForm,
  DashboardSubmitListingRequestForm,
} from "@/components/dashboard/DashboardListingForms";
import { isR2UploadConfigured } from "@/lib/r2-upload";
import { buildShopSetupCatalogOptions } from "@/lib/shop-setup-catalog-options";
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
  const listingFeeLabel = formatMoney(LISTING_FEE_CENTS);

  const printifyProducts = !isPlatform
    ? await prisma.product.findMany({
        where: { active: true, fulfillmentType: FulfillmentType.printify },
        select: {
          id: true,
          name: true,
          slug: true,
          minPriceCents: true,
          priceCents: true,
        },
        orderBy: { name: "asc" },
      })
    : [];

  const adminCatalogRows = !isPlatform
    ? await prisma.adminCatalogItem.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          name: true,
          variants: true,
          itemPlatformProductId: true,
          itemExampleListingUrl: true,
          itemMinPriceCents: true,
        },
      })
    : [];

  const catalogOptions = !isPlatform
    ? buildShopSetupCatalogOptions(adminCatalogRows, printifyProducts)
    : [];

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
            l.requestStatus === ListingRequestStatus.submitted ||
            l.requestStatus === ListingRequestStatus.approved ||
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
          catalogOptions={catalogOptions}
          steps={setupSteps}
          listingFeeLabel={listingFeeLabel}
          r2Configured={isR2UploadConfigured()}
        />
      ) : (
        <p className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-500">
          You are signed in as the platform catalog shop owner. Marketplace Connect and per-listing
          fees do not apply to this account.
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Listings</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Set your public price (at least the catalog minimum). Pay the {listingFeeLabel} listing fee
          before an admin can approve a submitted request. Platform catalog shop skips the fee.
        </p>
        <ul className="mt-4 space-y-6">
          {shop.listings.map((listing) => {
            const minCents =
              listing.product.minPriceCents > 0
                ? listing.product.minPriceCents
                : listing.product.priceCents;
            const minLabel = formatMoney(minCents);
            const canSubmit =
              listing.requestStatus === ListingRequestStatus.draft ||
              listing.requestStatus === ListingRequestStatus.rejected;
            const imagesDefault = Array.isArray(listing.requestImages)
              ? (listing.requestImages as string[]).join("\n")
              : "";

            return (
              <li
                key={listing.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-zinc-200">{listing.product.name}</span>
                  <span className="text-xs text-zinc-500">
                    {listing.active ? "active" : "inactive"} · {listing.requestStatus}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  Catalog: {listing.product.slug} · min {minLabel}
                </p>

                <DashboardListingPriceForm
                  listingId={listing.id}
                  priceDollarsFormatted={(listing.priceCents / 100).toFixed(2)}
                />

                {!isPlatform && !listing.listingFeePaidAt ? (
                  <form action={dashboardPayListingFee} className="mt-3">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <button
                      type="submit"
                      className="rounded border border-blue-900/60 bg-blue-950/30 px-3 py-1.5 text-xs text-blue-200 hover:border-blue-700/60"
                    >
                      Pay {listingFeeLabel} listing fee (Stripe)
                    </button>
                  </form>
                ) : !isPlatform && listing.listingFeePaidAt ? (
                  <p className="mt-2 text-xs text-emerald-600/90">
                    Listing fee paid{" "}
                    {listing.listingFeePaidAt.toISOString().slice(0, 10)}
                  </p>
                ) : null}

                {canSubmit ? (
                  <DashboardSubmitListingRequestForm
                    listingId={listing.id}
                    defaultImageUrlsText={imagesDefault}
                  />
                ) : (
                  <p className="mt-3 text-xs text-zinc-600">
                    Request status: {listing.requestStatus} — contact support if you need changes.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {shop.listings.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            No listings yet. Ask the platform admin to assign catalog products to your shop.
          </p>
        ) : null}
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Recent paid orders</h2>
        <p className="mt-1 text-xs text-zinc-600">Newest first (up to 20). Line splits are totals for that line.</p>
        <ul className="mt-4 space-y-3">
          {paidOrders.map((o) => (
            <li key={o.id} className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-400">
              <div className="flex justify-between gap-2 text-zinc-300">
                <span>{o.createdAt.toISOString().slice(0, 19)}Z</span>
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
      </section>

      <p className="mt-10 text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Platform home
        </Link>
      </p>

      <SiteLegalFooter />
    </main>
  );
}
