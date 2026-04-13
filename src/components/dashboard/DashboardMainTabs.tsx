"use client";

import { useId, useState } from "react";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import { dashboardPayListingFee } from "@/actions/dashboard-marketplace";
import {
  LISTING_FEE_FREE_SLOT_COUNT,
  listingFeeCentsForOrdinal,
} from "@/lib/marketplace-constants";
import {
  DashboardListingPriceForm,
  DashboardSubmitListingRequestForm,
} from "@/components/dashboard/DashboardListingForms";

export type DashboardListingRow = {
  id: string;
  active: boolean;
  requestStatus: ListingRequestStatus;
  priceCents: number;
  requestImages: unknown;
  listingFeePaidAt: string | null;
  /** 1-based order by shop creation time (oldest = 1). */
  listingOrdinal: number;
  product: {
    name: string;
    slug: string;
    minPriceCents: number;
    priceCents: number;
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
      return "Submitted — waiting for admin review.";
    case ListingRequestStatus.approved:
      return "Approved — visible on the shop once active and fee paid if required.";
    case ListingRequestStatus.rejected:
      return "Rejected — update and resubmit, or contact support.";
    default:
      return String(status);
  }
}

function statusBadgeClass(status: ListingRequestStatus, active: boolean): string {
  if (active) return "bg-emerald-950/50 text-emerald-300/90 ring-emerald-800/50";
  switch (status) {
    case ListingRequestStatus.submitted:
      return "bg-amber-950/40 text-amber-200/90 ring-amber-800/50";
    case ListingRequestStatus.approved:
      return "bg-sky-950/40 text-sky-200/90 ring-sky-800/50";
    case ListingRequestStatus.rejected:
      return "bg-red-950/40 text-red-200/90 ring-red-900/50";
    default:
      return "bg-zinc-900/80 text-zinc-400 ring-zinc-700/80";
  }
}

function ListingCard({
  listing,
  isPlatform,
  paidListingFeeLabel,
}: {
  listing: DashboardListingRow;
  isPlatform: boolean;
  paidListingFeeLabel: string;
}) {
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
  const feeCents = listingFeeCentsForOrdinal(listing.listingOrdinal);
  const isFreeListingSlot = feeCents === 0;

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-zinc-200">{listing.product.name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${statusBadgeClass(listing.requestStatus, listing.active)}`}
        >
          {listing.active ? "Live" : listing.requestStatus}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{requestStatusDescription(listing.requestStatus)}</p>
      <p className="mt-1 text-xs text-zinc-600">
        Catalog: {listing.product.slug} · min {minLabel}
      </p>

      <DashboardListingPriceForm
        listingId={listing.id}
        priceDollarsFormatted={(listing.priceCents / 100).toFixed(2)}
      />

      {!isPlatform && isFreeListingSlot ? (
        <p className="mt-2 text-xs text-emerald-600/90">
          No publication fee — free listing ({listing.listingOrdinal} of {LISTING_FEE_FREE_SLOT_COUNT}).
        </p>
      ) : !isPlatform && !listing.listingFeePaidAt ? (
        <form action={dashboardPayListingFee} className="mt-3">
          <input type="hidden" name="listingId" value={listing.id} />
          <button
            type="submit"
            className="rounded border border-blue-900/60 bg-blue-950/30 px-3 py-1.5 text-xs text-blue-200 hover:border-blue-700/60"
          >
            Pay {paidListingFeeLabel} listing fee (Stripe)
          </button>
        </form>
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
      ) : (
        <p className="mt-3 text-xs text-zinc-600">
          Request status: {listing.requestStatus} — contact support if you need changes.
        </p>
      )}
    </li>
  );
}

type TabId = "listings" | "orders";

export function DashboardMainTabs(props: {
  initialTab?: TabId;
  listingFeePolicySummary: string;
  paidListingFeeLabel: string;
  isPlatform: boolean;
  listings: DashboardListingRow[];
  paidOrders: DashboardPaidOrderRow[];
}) {
  const {
    initialTab = "listings",
    listingFeePolicySummary,
    paidListingFeeLabel,
    isPlatform,
    listings,
    paidOrders,
  } = props;
  const [tab, setTab] = useState<TabId>(initialTab);
  const baseId = useId();
  const listingsTabId = `${baseId}-tab-listings`;
  const ordersTabId = `${baseId}-tab-orders`;
  const listingsPanelId = `${baseId}-panel-listings`;
  const ordersPanelId = `${baseId}-panel-orders`;

  const liveListings = listings.filter((l) => l.active);
  const requestListings = listings.filter((l) => !l.active);

  const tabBtn = (id: TabId, label: string, tabId: string, panelId: string) => (
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

  return (
    <section className="mt-10">
      <div
        className="flex flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-950/40 p-1"
        role="tablist"
        aria-label="Dashboard"
      >
        {tabBtn("listings", "Listings", listingsTabId, listingsPanelId)}
        {tabBtn("orders", "Recent paid orders", ordersTabId, ordersPanelId)}
      </div>

      <div
        id={listingsPanelId}
        role="tabpanel"
        aria-labelledby={listingsTabId}
        hidden={tab !== "listings"}
        className="pt-6"
      >
        <p className="text-xs text-zinc-600">
          Set your public price (at least the catalog minimum). {listingFeePolicySummary} Paid slots must
          be settled before an admin can approve a submitted request. Platform catalog shop skips the fee.
        </p>

        {liveListings.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-500/90">
              Live on your shop
            </h3>
            <p className="mt-1 text-[11px] text-zinc-600">
              These listings are active on your storefront.
            </p>
            <ul className="mt-3 space-y-6">
              {liveListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isPlatform={isPlatform}
                  paidListingFeeLabel={paidListingFeeLabel}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {requestListings.length > 0 ? (
          <div className={liveListings.length > 0 ? "mt-10" : "mt-6"}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Listing requests & setup
            </h3>
            <p className="mt-1 text-[11px] text-zinc-600">
              Drafts, submitted requests, and inactive rows — pay fees, set pricing, and track status
              here.
            </p>
            <ul className="mt-3 space-y-6">
              {requestListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isPlatform={isPlatform}
                  paidListingFeeLabel={paidListingFeeLabel}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {listings.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">
            No listings yet. Use <strong className="text-zinc-400">Request first listing</strong> above to
            submit your first listing for review.
          </p>
        ) : null}
      </div>

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
