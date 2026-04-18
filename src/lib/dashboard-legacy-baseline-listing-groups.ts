import { ListingRequestStatus } from "@/generated/prisma/enums";
import type { AdminBaselineRow } from "@/lib/shop-baseline-catalog";

/** Minimal row shape for dashboard listing buckets (slug used for display only). */
export type DashboardListingRowLike = {
  id: string;
  requestItemName: string | null;
  requestImages: unknown;
  product: { slug: string };
};

export type GroupedDashboardListing<T> = { kind: "single"; row: T };

/** Row shape needed to split live / request / removed buckets (dashboard listings). */
export type DashboardListingBucketRow = DashboardListingRowLike & {
  active: boolean;
  requestStatus: ListingRequestStatus;
  creatorRemovedFromShopAt: string | null;
};

/** Same buckets as {@link buildGroupedListingSectionsForDashboard} — for tab badge `live / (live + request)`. */
export function dashboardListingTabBadgeCounts<T extends DashboardListingBucketRow>(
  allRows: T[],
): { live: number; livePlusRequested: number } {
  const live = allRows.filter(
    (l) => l.active && l.requestStatus !== ListingRequestStatus.rejected,
  );
  const request = allRows.filter(
    (l) =>
      !l.active &&
      l.creatorRemovedFromShopAt == null &&
      l.requestStatus !== ListingRequestStatus.rejected,
  );
  return { live: live.length, livePlusRequested: live.length + request.length };
}

/**
 * Server-only: builds the dashboard “Listings” tab sections — one card per listing (no variant grouping).
 */
export function buildGroupedListingSectionsForDashboard<T extends DashboardListingBucketRow>(
  _shopId: string,
  allRows: T[],
  _adminItems: AdminBaselineRow[],
): {
  live: GroupedDashboardListing<T>[];
  request: GroupedDashboardListing<T>[];
  removed: GroupedDashboardListing<T>[];
} {
  void _shopId;
  void _adminItems;
  const live = allRows.filter(
    (l) => l.active && l.requestStatus !== ListingRequestStatus.rejected,
  );
  const removed = allRows.filter(
    (l) =>
      l.creatorRemovedFromShopAt != null || l.requestStatus === ListingRequestStatus.rejected,
  );
  const request = allRows.filter(
    (l) =>
      !l.active &&
      l.creatorRemovedFromShopAt == null &&
      l.requestStatus !== ListingRequestStatus.rejected,
  );
  const toSingles = (bucket: T[]) => bucket.map((row) => ({ kind: "single" as const, row }));
  return { live: toSingles(live), request: toSingles(request), removed: toSingles(removed) };
}
