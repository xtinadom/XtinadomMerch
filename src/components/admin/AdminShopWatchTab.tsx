"use client";

import Link from "next/link";
import { Fragment, useCallback, useMemo, useState } from "react";
import { adminDeleteListingRemovalRecord, adminFreezeShopListing } from "@/actions/admin-marketplace";
import { DashboardNoticeBody } from "@/components/dashboard/DashboardNoticeBody";

export type ShopWatchDetail = {
  listingId: string;
  productName: string;
  productSlug: string;
  /** Paid fee, unpaid fee, standard free slots, or promo / founder-style free listings. */
  listingFeeKind: "paid" | "unpaid" | "free_slot" | "free_promo";
  rowKind: "active" | "frozen" | "removed" | "other";
  queueRemoved: boolean;
  notes: string | null;
  /** When `rowKind` is other: listing request status (draft, approved but not live, etc.). */
  pipelineStatus?: string;
  /** Listing and product flags for context when not storefront-live. */
  listingActive?: boolean;
  productActive?: boolean;
  /** From newest `listing_rejected` notice (admin reject / queue removal). */
  rejectionReasonText?: string | null;
};

export type ShopWatchRow = {
  shopId: string;
  displayName: string;
  slug: string;
  /** Live on storefront plus approved-but-not-live rows (same roll-up as the Active column). */
  activeListingsCount: number;
  /** Paid checkout orders for this shop (`Order.status` = paid). */
  salesCount: number;
  /** Listings where a publication fee applied and was paid (matches blue $ in details; excludes free / promo). */
  paidListingsCount: number;
  frozenCount: number;
  /** Creator self-removals plus admin-rejected rows (same roll-up as the Removed column). */
  removedCount: number;
  detailsActive: ShopWatchDetail[];
  detailsFrozen: ShopWatchDetail[];
  detailsRemoved: ShopWatchDetail[];
  /** Submitted listing requests (shown under “Requested”). */
  detailsOtherRequested: ShopWatchDetail[];
  /** Draft / Printify setup — pipeline rows excluding submitted (see Requested). */
  detailsOtherPipeline: ShopWatchDetail[];
  /** Approved but not on storefront (e.g. fee pending, inactive product). */
  detailsOtherApproved: ShopWatchDetail[];
  /** Admin-rejected — rendered together with creator-removed under the Removed section. */
  detailsOtherRejected: ShopWatchDetail[];
};

/** Creator marketplace roll-up (non–platform-catalog shops). */
export type ShopWatchMarketplaceStats = {
  creatorAccountCount: number;
  shopsWithListingCount: number;
  shopsWithPaidListingCount: number;
};

/** Table scope: all shops, or shops with any live / frozen / creator-removed listings. */
type TableFilter = "all" | "approved" | "frozen" | "removed";

function sortWatchDetails(a: ShopWatchDetail, b: ShopWatchDetail): number {
  return a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" });
}

/** Approved + listing still “on” (can be frozen off the storefront via `adminFreezeShopListing`). */
function canFreezeListingForShopWatch(d: ShopWatchDetail): boolean {
  if (d.rowKind === "active") return true;
  return (
    d.rowKind === "other" &&
    d.pipelineStatus === "approved" &&
    d.listingActive === true
  );
}

function DetailSection(props: {
  title: string;
  tone: "emerald" | "sky" | "fuchsia" | "amber" | "zinc";
  items: ShopWatchDetail[];
  showDelete: boolean;
  /** Show Remove for live / approved-on listings (calls `adminFreezeShopListing`). */
  showRemoveFromShop?: boolean;
}) {
  const { title, tone, items, showDelete, showRemoveFromShop } = props;
  if (items.length === 0) return null;

  const titleClass =
    tone === "emerald"
      ? "text-emerald-400/90"
      : tone === "sky"
        ? "text-sky-400/90"
        : tone === "fuchsia"
          ? "text-fuchsia-400/90"
          : tone === "amber"
            ? "text-amber-400/90"
            : "text-zinc-400/90";

  return (
    <div className="mt-4 first:mt-0">
      <p className={`mb-2 text-[11px] font-medium uppercase tracking-wide ${titleClass}`}>
        {title}{" "}
        <span className="tabular-nums text-zinc-500">({items.length})</span>
      </p>
      <ul className="space-y-3 text-xs">
        {items.map((d) => (
          <li
            key={d.listingId}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium text-zinc-200">{d.productName}</span>
                <span className="font-mono text-[11px] text-zinc-600">{d.productSlug}</span>
                {d.listingFeeKind === "paid" ? (
                  <span
                    className="select-none text-sm font-semibold text-blue-400"
                    title="Listing publication fee paid"
                    aria-label="Listing publication fee paid"
                  >
                    $
                  </span>
                ) : d.listingFeeKind === "free_slot" ? (
                  <span
                    className="select-none text-[11px] font-medium text-zinc-500"
                    title="Standard free publication slot (first listings in the shop)"
                    aria-label="Standard free publication slot"
                  >
                    --
                  </span>
                ) : d.listingFeeKind === "free_promo" ? (
                  <span
                    className="select-none text-[11px] font-medium text-emerald-300/90"
                    title="Complimentary listing: founder shop, promotion, or comp slot"
                    aria-label="Complimentary or promotional listing"
                  >
                    :)
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 flex flex-wrap gap-2">
                {d.rowKind === "active" ? (
                  <span className="rounded-full bg-emerald-950/45 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200/90 ring-1 ring-emerald-800/50">
                    Active
                  </span>
                ) : null}
                {d.rowKind === "frozen" ? (
                  <span className="rounded-full bg-sky-950/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-200/90 ring-1 ring-sky-800/50">
                    Frozen
                  </span>
                ) : null}
                {d.rowKind === "removed" ? (
                  <span className="rounded-full bg-fuchsia-950/45 px-2 py-0.5 text-[10px] font-medium tracking-wide text-fuchsia-200/90 ring-1 ring-fuchsia-800/50">
                    Creator removed
                  </span>
                ) : null}
                {d.rowKind === "other" ? (
                  <span
                    className={
                      d.pipelineStatus === "rejected"
                        ? "rounded-full bg-rose-950/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-200/95 ring-1 ring-rose-800/65"
                        : d.pipelineStatus === "approved"
                          ? "rounded-full bg-emerald-950/45 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200/90 ring-1 ring-emerald-800/50"
                          : d.pipelineStatus === "submitted"
                            ? "rounded-full bg-amber-950/45 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90 ring-1 ring-amber-900/50"
                            : "rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300 ring-1 ring-zinc-600/80"
                    }
                  >
                    {(d.pipelineStatus ?? "other").replace(/_/g, " ")}
                  </span>
                ) : null}
                {d.rowKind === "other" &&
                (d.listingActive != null || d.productActive != null) ? (
                  <span className="text-[10px] text-zinc-500">
                    listing {d.listingActive ? "on" : "off"} · product {d.productActive ? "on" : "off"}
                  </span>
                ) : null}
                {d.queueRemoved ? (
                  <span className="rounded-full bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90 ring-1 ring-amber-800/50">
                    Removed from queue
                  </span>
                ) : null}
              </p>
              {d.pipelineStatus === "rejected" && d.rejectionReasonText ? (
                <p className="mt-1.5 text-[10px] leading-snug text-rose-200/85">
                  <DashboardNoticeBody body={d.rejectionReasonText} />
                </p>
              ) : null}
              {showDelete ? (
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                  <span className="font-medium text-zinc-600">Notes: </span>
                  {d.notes?.trim() ? (
                    <span className="text-zinc-400">{d.notes.trim()}</span>
                  ) : (
                    <span className="text-zinc-600">None</span>
                  )}
                </p>
              ) : null}
            </div>
            {showRemoveFromShop && canFreezeListingForShopWatch(d) ? (
              <form action={adminFreezeShopListing} className="shrink-0 pt-0.5">
                <input type="hidden" name="listingId" value={d.listingId} />
                <button
                  type="submit"
                  title="Hides this listing from the creator’s public shop (same as Freeze on Listing requests)."
                  className="rounded border border-amber-900/50 bg-amber-950/30 px-2.5 py-1 text-[11px] text-amber-200/90 transition hover:border-amber-700/50 hover:bg-amber-950/50"
                >
                  Remove
                </button>
              </form>
            ) : null}
            {showDelete ? (
              <form action={adminDeleteListingRemovalRecord} className="shrink-0 pt-0.5">
                <input type="hidden" name="listingId" value={d.listingId} />
                <button
                  type="submit"
                  title="Clears removal audit (freeze, creator remove, queue timestamps, notes). Rejected-only rows also reset to draft so they leave this history. Does not delete the listing record."
                  className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900"
                >
                  delete
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatBlock(props: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-[10rem] flex-1 rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{props.label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">{props.value}</p>
      {props.hint ? <p className="mt-1 text-[10px] leading-snug text-zinc-600">{props.hint}</p> : null}
    </div>
  );
}

export function AdminShopWatchTab(props: {
  rows: ShopWatchRow[];
  marketplaceStats: ShopWatchMarketplaceStats;
}) {
  const { rows, marketplaceStats: stats } = props;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState<TableFilter>("all");

  const toggle = useCallback((shopId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(shopId)) next.delete(shopId);
      else next.add(shopId);
      return next;
    });
  }, []);

  /** Which listing groups to show inside expanded rows (does not hide shops in the table). */
  const detailVisibility = useMemo(() => {
    switch (tableFilter) {
      case "all":
        return {
          active: true,
          frozen: true,
          removed: true,
          otherPipeline: true,
          otherApproved: true,
        };
      case "approved":
        return {
          active: true,
          frozen: false,
          removed: false,
          otherPipeline: false,
          otherApproved: true,
        };
      case "frozen":
        return {
          active: false,
          frozen: true,
          removed: false,
          otherPipeline: false,
          otherApproved: false,
        };
      case "removed":
        return {
          active: false,
          frozen: false,
          removed: true,
          otherPipeline: false,
          otherApproved: false,
        };
      default:
        return {
          active: true,
          frozen: true,
          removed: true,
          otherPipeline: true,
          otherApproved: true,
        };
    }
  }, [tableFilter]);

  const grandActive = rows.reduce((acc, r) => acc + r.activeListingsCount, 0);
  const grandSales = rows.reduce((acc, r) => acc + r.salesCount, 0);
  const grandPaid = rows.reduce((acc, r) => acc + r.paidListingsCount, 0);
  const grandFrozen = rows.reduce((acc, r) => acc + r.frozenCount, 0);
  const grandRemoved = rows.reduce((acc, r) => acc + r.removedCount, 0);
  const grandOther = rows.reduce(
    (acc, r) => acc + r.detailsOtherRequested.length + r.detailsOtherPipeline.length,
    0,
  );

  /** Same ratio as table footer Paid ÷ “Shops with a paid listing fee” (not a separate global aggregate). */
  const avgPaidDisplay =
    stats.shopsWithPaidListingCount > 0
      ? (grandPaid / stats.shopsWithPaidListingCount).toFixed(1)
      : "—";

  return (
    <section aria-label="Shop watch">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Shop watch</h2>
      <div
        className="mt-3 flex flex-wrap gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3"
        aria-label="Creator marketplace summary"
      >
        <StatBlock
          label="Creator accounts"
          value={stats.creatorAccountCount}
          hint="Shop owner logins (excludes platform catalog shop)."
        />
        <StatBlock
          label="Shops with a listing"
          value={stats.shopsWithListingCount}
          hint="At least one shop listing row exists."
        />
        <StatBlock
          label="Shops with a paid listing fee"
          value={stats.shopsWithPaidListingCount}
          hint="At least one listing has listingFeePaidAt set."
        />
        <StatBlock
          label="Avg paid listings (those shops)"
          value={avgPaidDisplay}
          hint={
            stats.shopsWithPaidListingCount > 0
              ? "Table “Paid” column total ÷ shops with ≥1 paid listing fee (matches footer ÷ third summary card)."
              : "No shops with a paid listing fee yet."
          }
        />
      </div>
      <p className="mt-4 text-xs text-zinc-600">
        The table always lists every active creator shop. Use the filter to show or hide{" "}
        <strong className="font-medium text-zinc-500">listing groups</strong> under each shop:{" "}
        <strong className="font-medium text-zinc-500">Approved</strong> = the Live group (storefront-active plus
        approved-but-not-live, e.g. fee pending); <strong className="font-medium text-zinc-500">Frozen</strong> = admin
        freeze; <strong className="font-medium text-zinc-500">Removed</strong> = creator self-removals and admin-rejected
        requests;         <strong className="font-medium text-zinc-500">All</strong> also shows{" "}
        <strong className="font-medium text-zinc-500">Requested</strong> (submitted) and pipeline rows (draft / Printify).{" "}
        <strong className="font-medium text-zinc-500">Remove</strong> (Live group) hides an approved listing that is still
        active on the shop from the public storefront (same as Freeze on Listing requests).{" "}
        <strong className="font-medium text-zinc-500">delete</strong> applies to frozen and creator-removed listing rows only.
      </p>

      <div
        className="mt-4 flex flex-wrap items-center gap-2"
        role="radiogroup"
        aria-label="Which listing groups to show in expanded shop details"
      >
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Listings:</span>
        {(
          [
            {
              id: "all" as const,
              label: "All",
              title:
                "Show Live, frozen, Removed, Requested (submitted), and pipeline (draft / Printify)",
            },
            {
              id: "approved" as const,
              label: "Approved",
              title: "Live storefront listings and approved rows not live yet (e.g. fee pending)",
            },
            {
              id: "frozen" as const,
              label: "Frozen",
              title: "Show only admin-frozen listings when expanded",
            },
            {
              id: "removed" as const,
              label: "Removed",
              title: "Creator-removed listings and admin-rejected listing requests",
            },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={tableFilter === opt.id}
            title={opt.title}
            onClick={() => setTableFilter(opt.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              tableFilter === opt.id
                ? "border-zinc-500 bg-zinc-800/80 text-zinc-100"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {rows.length > 0 ? (
        <p className="mt-3 text-xs tabular-nums text-zinc-500">
          {rows.length} creator shop{rows.length === 1 ? "" : "s"} · {grandActive} active · {grandSales} sales ·{" "}
          {grandPaid} paid · {grandFrozen} frozen · {grandRemoved} removed · {grandOther} other (totals)
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No active creator shops.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm text-zinc-300">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <th className="w-10 px-2 py-2.5" aria-label="Expand details" />
                <th className="px-3 py-2.5">Shop</th>
                <th
                  className="whitespace-nowrap px-3 py-2.5 text-center"
                  title="Matches the Live details: storefront-active plus approved-not-live (e.g. fee pending)"
                >
                  Active
                </th>
                <th
                  className="whitespace-nowrap px-3 py-2.5 text-center"
                  title="Paid customer orders for this shop (checkout completed)"
                >
                  Sales
                </th>
                <th
                  className="whitespace-nowrap px-3 py-2.5 text-center"
                  title="Listings with a charged publication fee that is paid (excludes free slots and promo/founder waivers)"
                >
                  Paid
                </th>
                <th
                  className="whitespace-nowrap px-3 py-2.5 text-center"
                  title="Listings admin-frozen off the storefront"
                >
                  Frozen
                </th>
                <th
                  className="whitespace-nowrap px-3 py-2.5 text-center"
                  title="Creator-removed listings plus admin-rejected listing requests"
                >
                  Removed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/90">
              <tr className="border-b border-zinc-800 bg-zinc-900/35">
                <td className="px-2 py-3 align-middle" aria-hidden />
                <th
                  scope="row"
                  className="px-3 py-3 text-left text-sm font-semibold text-zinc-200"
                  title="Totals across all creator shops in this table"
                >
                  All shops
                </th>
                <td className="px-3 py-3 text-center text-sm font-semibold tabular-nums text-zinc-200">
                  {grandActive}
                </td>
                <td className="px-3 py-3 text-center text-sm font-semibold tabular-nums text-violet-200/90">
                  {grandSales}
                </td>
                <td className="px-3 py-3 text-center text-sm font-semibold tabular-nums text-amber-200/90">
                  {grandPaid}
                </td>
                <td className="px-3 py-3 text-center text-sm font-semibold tabular-nums text-sky-200/90">
                  {grandFrozen}
                </td>
                <td className="px-3 py-3 text-center text-sm font-semibold tabular-nums text-fuchsia-200/85">
                  {grandRemoved}
                </td>
              </tr>
              {rows.map((r) => {
                const isOpen = expanded.has(r.shopId);
                const mergedLiveSection = [...r.detailsActive, ...r.detailsOtherApproved].sort(sortWatchDetails);
                const mergedRemovedSection = [...r.detailsRemoved, ...r.detailsOtherRejected].sort(sortWatchDetails);
                const mergedRequestedSection = [...r.detailsOtherRequested].sort(sortWatchDetails);
                const mergedPipelineOnly = [...r.detailsOtherPipeline].sort(sortWatchDetails);
                const visibleListingCount =
                  (detailVisibility.active ? mergedLiveSection.length : 0) +
                  (detailVisibility.frozen ? r.detailsFrozen.length : 0) +
                  (detailVisibility.removed ? mergedRemovedSection.length : 0) +
                  (detailVisibility.otherPipeline
                    ? r.detailsOtherRequested.length + r.detailsOtherPipeline.length
                    : 0);
                return (
                  <Fragment key={r.shopId}>
                    <tr>
                      <td className="px-2 py-3 align-middle">
                        <button
                          type="button"
                          onClick={() => toggle(r.shopId)}
                          aria-expanded={isOpen}
                          aria-controls={`shop-watch-details-${r.shopId}`}
                          className="flex size-8 items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                          title={isOpen ? "Hide listing details" : "Show listing details"}
                        >
                          <span className="sr-only">{isOpen ? "Collapse" : "Expand"} details for {r.displayName}</span>
                          <svg
                            className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/s/${r.slug}`}
                          className="font-medium text-zinc-200 underline-offset-2 hover:text-blue-300 hover:underline"
                        >
                          {r.displayName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-zinc-200">{r.activeListingsCount}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-violet-200/90">{r.salesCount}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-amber-200/90">{r.paidListingsCount}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-sky-200/90">{r.frozenCount}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-fuchsia-200/85">{r.removedCount}</td>
                    </tr>
                    {isOpen ? (
                      <tr className="bg-zinc-950/60">
                        <td colSpan={7} className="px-3 py-3" id={`shop-watch-details-${r.shopId}`}>
                          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                            Listing details
                          </p>
                          {detailVisibility.active && mergedLiveSection.length > 0 ? (
                            <DetailSection
                              title="Live"
                              tone="emerald"
                              items={mergedLiveSection}
                              showDelete={false}
                              showRemoveFromShop
                            />
                          ) : null}
                          {detailVisibility.frozen ? (
                            <DetailSection title="Frozen" tone="sky" items={r.detailsFrozen} showDelete />
                          ) : null}
                          {detailVisibility.removed && mergedRemovedSection.length > 0 ? (
                            <DetailSection title="Removed" tone="fuchsia" items={mergedRemovedSection} showDelete />
                          ) : null}
                          {tableFilter === "all" && mergedRequestedSection.length > 0 ? (
                            <DetailSection
                              title="Requested"
                              tone="amber"
                              items={mergedRequestedSection}
                              showDelete={false}
                            />
                          ) : null}
                          {tableFilter === "all" && mergedPipelineOnly.length > 0 ? (
                            <DetailSection
                              title="Pipeline (draft / Printify)"
                              tone="zinc"
                              items={mergedPipelineOnly}
                              showDelete={false}
                            />
                          ) : null}
                          {visibleListingCount === 0 ? (
                            <p className="mt-2 text-xs text-zinc-600">
                              {tableFilter === "all" &&
                              mergedLiveSection.length === 0 &&
                              r.detailsFrozen.length === 0 &&
                              mergedRemovedSection.length === 0 &&
                              mergedRequestedSection.length === 0 &&
                              mergedPipelineOnly.length === 0
                                ? "No listings in these categories for this shop."
                                : "No listings match the current filter for this shop."}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
