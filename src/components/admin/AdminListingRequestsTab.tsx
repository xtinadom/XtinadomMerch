"use client";

import { useCallback, useMemo, useState } from "react";
import {
  adminApproveListingRequest,
  adminFreezeShopListing,
  adminMarkPrintifyListingReady,
  adminRejectListingRequest,
  adminRemoveListingFromRequestsQueue,
} from "@/actions/admin-marketplace";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";
import { AdminApproveSubmitButton, AdminFreezeSubmitButton } from "@/components/admin/AdminListingRequestActionButtons";

export type ListingRequestTabRow = {
  id: string;
  active: boolean;
  adminRemovedFromShopAt: string | null;
  updatedAt: string;
  requestStatus: ListingRequestStatus;
  requestItemName: string | null;
  requestImages: unknown;
  listingPrintifyProductId: string | null;
  listingPrintifyVariantId: string | null;
  listingFeePaidAt: string | null;
  listingOrdinal: number;
  shop: { displayName: string; slug: string };
  product: { id: string; name: string; slug: string; fulfillmentType: FulfillmentType };
};

type RequestsTabId = "new" | "fee";

function sortRows(rows: ListingRequestTabRow[]): ListingRequestTabRow[] {
  return [...rows].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function ListingRequestCard({ r }: { r: ListingRequestTabRow }) {
  const imgs = Array.isArray(r.requestImages) ? (r.requestImages as string[]) : [];
  const isSubmitted = r.requestStatus === ListingRequestStatus.submitted;
  const isPrintifyReady = r.requestStatus === ListingRequestStatus.printify_item_created;
  const isApproved = r.requestStatus === ListingRequestStatus.approved;
  const adminRemoved = r.adminRemovedFromShopAt != null;
  const needsPrintifyVariant = r.product.fulfillmentType === FulfillmentType.printify;
  const statusChip =
    isApproved && r.active
      ? "On shop"
      : isApproved && !r.active && adminRemoved
        ? "Frozen"
        : isApproved && !r.active
          ? "Fee pending"
          : null;

  return (
    <li
      className={`rounded-lg border p-4 text-sm text-zinc-300 ${
        isApproved ? "border-emerald-900/40 bg-emerald-950/10" : "border-zinc-800 bg-zinc-950/20"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-medium">{r.shop.displayName}</span>
          <span className="font-mono text-xs text-zinc-500">/s/{r.shop.slug}</span>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 ring-1 ring-zinc-700">
            {r.requestStatus}
          </span>
          {statusChip ? (
            <span className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300/90 ring-1 ring-emerald-800/50">
              {statusChip}
            </span>
          ) : null}
        </p>
        <form action={adminRemoveListingFromRequestsQueue} className="shrink-0">
          <input type="hidden" name="listingId" value={r.id} />
          <button
            type="submit"
            title="Remove from this queue and record under Removed items. Takes live listings off the shop if not already frozen."
            className="rounded border border-red-900/50 bg-red-950/20 px-2.5 py-1 text-[11px] font-medium text-red-200/90 hover:border-red-800/70 hover:bg-red-950/35"
          >
            Remove
          </button>
        </form>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Catalog product (one listing — all variants approved or rejected together):{" "}
        <span className="text-zinc-400">{r.product.name}</span> ({r.product.slug}) · {r.product.fulfillmentType}
      </p>
      {r.requestItemName?.trim() ? (
        <p className="mt-1 text-xs text-zinc-400">
          Creator name: <span className="font-medium text-zinc-200">{r.requestItemName.trim()}</span>
        </p>
      ) : null}
      {imgs.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-xs text-zinc-500">
          {imgs.map((u, i) => (
            <li key={i} className="break-all">
              <a
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400/90 underline decoration-blue-500/40 underline-offset-2 hover:text-blue-300"
              >
                {u}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-zinc-600">No image URLs submitted.</p>
      )}

      {isSubmitted ? (
        <form action={adminMarkPrintifyListingReady} className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Step 1 — Printify IDs</p>
          <input type="hidden" name="listingId" value={r.id} />
          <label className="block text-xs text-zinc-500">
            Printify product ID
            <input
              name="printifyProductId"
              required
              defaultValue={r.listingPrintifyProductId ?? ""}
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200"
              autoComplete="off"
            />
          </label>
          {needsPrintifyVariant ? (
            <label className="block text-xs text-zinc-500">
              Default Printify variant ID (checkout / fulfillment — not a separate approval; the whole product is one
              listing)
              <input
                name="printifyVariantId"
                required
                defaultValue={r.listingPrintifyVariantId ?? ""}
                className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200"
                autoComplete="off"
              />
            </label>
          ) : (
            <label className="block text-xs text-zinc-500">
              Variant ID (optional — leave empty for manual fulfillment)
              <input
                name="printifyVariantId"
                defaultValue={r.listingPrintifyVariantId ?? ""}
                className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200"
                autoComplete="off"
              />
            </label>
          )}
          <button
            type="submit"
            className="rounded bg-sky-900/40 px-3 py-1 text-xs text-sky-200 hover:bg-sky-900/60"
          >
            Save Printify IDs &amp; mark “Printify item created”
          </button>
        </form>
      ) : null}

      {isPrintifyReady ? (
        <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Step 2 — Decision</p>
          <p className="text-xs text-zinc-500">
            Printify product:{" "}
            <span className="font-mono text-zinc-400">{r.listingPrintifyProductId ?? "—"}</span>
            {needsPrintifyVariant ? (
              <>
                {" "}
                · default variant (checkout):{" "}
                <span className="font-mono text-zinc-400">{r.listingPrintifyVariantId ?? "—"}</span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Approve or reject this entire listing — catalog variants are not approved individually.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <form action={adminApproveListingRequest} className="inline-flex flex-wrap items-end gap-2">
              <input type="hidden" name="listingId" value={r.id} />
              <input type="hidden" name="productId" value={r.product.id} />
              <AdminApproveSubmitButton />
            </form>
            <form action={adminRejectListingRequest} className="inline">
              <input type="hidden" name="listingId" value={r.id} />
              <button
                type="submit"
                className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500"
              >
                Reject
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isSubmitted ? (
        <form action={adminRejectListingRequest} className="mt-2">
          <input type="hidden" name="listingId" value={r.id} />
          <button
            type="submit"
            className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500"
          >
            Reject
          </button>
        </form>
      ) : null}

      {isApproved ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-800/80 pt-4">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-200 ring-1 ring-emerald-800/50"
            role="status"
          >
            <span className="text-emerald-400" aria-hidden>
              ✓
            </span>
            Approved
          </span>
          {r.active ? (
            <form action={adminFreezeShopListing} className="inline-flex flex-wrap items-center gap-2">
              <input type="hidden" name="listingId" value={r.id} />
              <AdminFreezeSubmitButton />
              <span className="text-[11px] text-zinc-600">Hides this listing from the creator&apos;s shop.</span>
            </form>
          ) : adminRemoved ? (
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">Frozen</span> — not shown on the shop.
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">Awaiting publication fee</span> — listing{" "}
              <span className="tabular-nums text-zinc-400">#{r.listingOrdinal}</span> requires payment before it can go
              live. After the creator pays (or free-slot waiver applies), this row leaves Listing requests and you can
              follow it under <span className="text-zinc-400">Shop watch</span>.
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}

export function AdminListingRequestsTab(props: { rows: ListingRequestTabRow[] }) {
  const { rows } = props;
  const [tab, setTab] = useState<RequestsTabId>("new");

  const newRows = useMemo(
    () =>
      sortRows(
        rows.filter(
          (r) =>
            r.requestStatus === ListingRequestStatus.submitted ||
            r.requestStatus === ListingRequestStatus.printify_item_created,
        ),
      ),
    [rows],
  );

  const feeRows = useMemo(
    () => sortRows(rows.filter((r) => r.requestStatus === ListingRequestStatus.approved)),
    [rows],
  );

  const setTabNew = useCallback(() => setTab("new"), []);
  const setTabFee = useCallback(() => setTab("fee"), []);

  const visibleRows = tab === "new" ? newRows : feeRows;

  return (
    <section aria-label="Listing requests">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Listing requests</h2>
      <p className="mt-1 text-xs text-zinc-600">
        <strong className="font-medium text-zinc-500">New requests</strong>: enter Printify IDs, then approve or reject the
        whole catalog product (one listing; all variants together).{" "}
        <strong className="font-medium text-zinc-500">Awaiting fee</strong>: approved listings that still need a paid
        publication fee (not in the free slots). Once the fee is recorded or the slot is free, the row leaves this tab
        — use <strong className="font-medium text-zinc-500">Shop watch</strong> for live / frozen / removed listings.
      </p>

      <div
        className="mt-4 flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3"
        role="tablist"
        aria-label="Listing requests views"
      >
        <button
          type="button"
          role="tab"
          id="listing-requests-tab-new"
          aria-selected={tab === "new"}
          aria-controls="listing-requests-panel-new"
          onClick={setTabNew}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            tab === "new"
              ? "border-zinc-500 bg-zinc-800/80 text-zinc-100"
              : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          }`}
        >
          New requests
          <span className="ml-1.5 tabular-nums text-zinc-500">({newRows.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          id="listing-requests-tab-fee"
          aria-selected={tab === "fee"}
          aria-controls="listing-requests-panel-fee"
          onClick={setTabFee}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            tab === "fee"
              ? "border-zinc-500 bg-zinc-800/80 text-zinc-100"
              : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          }`}
        >
          Awaiting listing fee
          <span className="ml-1.5 tabular-nums text-zinc-500">({feeRows.length})</span>
        </button>
      </div>

      <div
        role="tabpanel"
        id={tab === "new" ? "listing-requests-panel-new" : "listing-requests-panel-fee"}
        aria-labelledby={tab === "new" ? "listing-requests-tab-new" : "listing-requests-tab-fee"}
        className="mt-4"
      >
        {visibleRows.length > 0 ? (
          <ul className="space-y-4">
            {visibleRows.map((r) => (
              <ListingRequestCard key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600">
            {tab === "new"
              ? "No new requests awaiting Printify setup or approval."
              : "No approved listings waiting on a publication fee."}
          </p>
        )}
      </div>
    </section>
  );
}
