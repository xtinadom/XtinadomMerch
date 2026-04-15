import { ListingRequestStatus } from "@/generated/prisma/enums";
import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";
import type { AdminBaselineRow } from "@/lib/shop-baseline-catalog";
import { computeBaselineStubSlug } from "@/lib/shop-baseline-stub-slug";

export type DashboardListingRowLike = {
  id: string;
  requestItemName: string | null;
  requestImages: unknown;
  product: { slug: string };
};

export type LegacyBaselineListingGroup<T extends DashboardListingRowLike> = {
  kind: "legacyVariantGroup";
  /** Same order as the original listing list (first occurrence preserved). */
  members: Array<{ row: T; variantLabel: string }>;
  parentItemName: string;
};

export type GroupedDashboardListing<T extends DashboardListingRowLike> =
  | { kind: "single"; row: T }
  | LegacyBaselineListingGroup<T>;

function normalizeBatchKey(requestItemName: string | null, requestImages: unknown): string {
  const n = (requestItemName ?? "").trim().toLowerCase();
  const img = Array.isArray(requestImages) ? JSON.stringify(requestImages) : String(requestImages ?? "");
  return `${n}|||${img}`;
}

/**
 * Older “all variants” submissions created one listing per catalog size (separate stub products).
 * Group those rows for dashboard display when they share the same admin catalog line, shop label, and artwork.
 */
export function groupLegacyBaselineVariantListingRows<T extends DashboardListingRowLike>(
  shopId: string,
  rowsInOrder: T[],
  adminItems: AdminBaselineRow[],
): GroupedDashboardListing<T>[] {
  type SlugMeta = { itemId: string; variantLabel: string; parentName: string };
  const slugToMeta = new Map<string, SlugMeta>();
  for (const item of adminItems) {
    const variants = parseAdminCatalogVariantsJson(item.variants);
    const parentName = item.name.trim() || "Catalog item";
    for (const v of variants) {
      const slug = computeBaselineStubSlug(shopId, item.id, `var:${v.id}`);
      slugToMeta.set(slug, { itemId: item.id, variantLabel: v.label, parentName });
    }
  }

  const assigned = new Set<string>();
  const out: GroupedDashboardListing<T>[] = [];

  for (const row of rowsInOrder) {
    if (assigned.has(row.id)) continue;

    const meta = slugToMeta.get(row.product.slug);
    if (!meta) {
      out.push({ kind: "single", row });
      continue;
    }

    const batchKey = `${meta.itemId}|||${normalizeBatchKey(row.requestItemName, row.requestImages)}`;

    const siblingIds = new Set<string>();
    for (const r of rowsInOrder) {
      const m = slugToMeta.get(r.product.slug);
      if (!m || m.itemId !== meta.itemId) continue;
      const k = `${m.itemId}|||${normalizeBatchKey(r.requestItemName, r.requestImages)}`;
      if (k === batchKey) siblingIds.add(r.id);
    }

    if (siblingIds.size <= 1) {
      out.push({ kind: "single", row });
      continue;
    }

    const orderedSiblings = rowsInOrder.filter((r) => siblingIds.has(r.id));
    for (const r of orderedSiblings) assigned.add(r.id);

    const members = orderedSiblings.map((r) => {
      const m = slugToMeta.get(r.product.slug)!;
      return { row: r, variantLabel: m.variantLabel };
    });

    out.push({
      kind: "legacyVariantGroup",
      members,
      parentItemName: meta.parentName,
    });
  }

  return out;
}

/**
 * Admin queue mixes multiple shops — build per-stub slug keys for every shop that appears in `rows`.
 * Groups legacy “one stub per variant” rows that share catalog line + creator label + artwork for the same shop.
 */
export function groupLegacyBaselineVariantAdminQueueRows<T extends DashboardListingRowLike & { shopId: string }>(
  rowsInOrder: T[],
  adminItems: AdminBaselineRow[],
): GroupedDashboardListing<T>[] {
  type SlugMeta = { itemId: string; variantLabel: string; parentName: string; shopId: string };
  const slugToMeta = new Map<string, SlugMeta>();
  const shopIds = [...new Set(rowsInOrder.map((r) => r.shopId))];
  for (const shopId of shopIds) {
    for (const item of adminItems) {
      const variants = parseAdminCatalogVariantsJson(item.variants);
      const parentName = item.name.trim() || "Catalog item";
      for (const v of variants) {
        const slug = computeBaselineStubSlug(shopId, item.id, `var:${v.id}`);
        slugToMeta.set(slug, { itemId: item.id, variantLabel: v.label, parentName, shopId });
      }
    }
  }

  const assigned = new Set<string>();
  const out: GroupedDashboardListing<T>[] = [];

  for (const row of rowsInOrder) {
    if (assigned.has(row.id)) continue;

    const meta = slugToMeta.get(row.product.slug);
    if (!meta || meta.shopId !== row.shopId) {
      out.push({ kind: "single", row });
      continue;
    }

    const batchKey = `${row.shopId}|||${meta.itemId}|||${normalizeBatchKey(row.requestItemName, row.requestImages)}`;

    const siblingIds = new Set<string>();
    for (const r of rowsInOrder) {
      const m = slugToMeta.get(r.product.slug);
      if (!m || m.itemId !== meta.itemId || m.shopId !== row.shopId) continue;
      const k = `${r.shopId}|||${m.itemId}|||${normalizeBatchKey(r.requestItemName, r.requestImages)}`;
      if (k === batchKey) siblingIds.add(r.id);
    }

    if (siblingIds.size <= 1) {
      out.push({ kind: "single", row });
      continue;
    }

    const orderedSiblings = rowsInOrder.filter((r) => siblingIds.has(r.id));
    for (const r of orderedSiblings) assigned.add(r.id);

    const members = orderedSiblings.map((r) => {
      const m = slugToMeta.get(r.product.slug)!;
      return { row: r, variantLabel: m.variantLabel };
    });

    out.push({
      kind: "legacyVariantGroup",
      members,
      parentItemName: meta.parentName,
    });
  }

  return out;
}

/** Row shape needed to split live / request / removed buckets (dashboard listings). */
export type DashboardListingBucketRow = DashboardListingRowLike & {
  active: boolean;
  requestStatus: ListingRequestStatus;
  creatorRemovedFromShopAt: string | null;
};

/**
 * Server-only: builds the same grouped lists the dashboard “Listings” tab used to compute on the client.
 */
export function buildGroupedListingSectionsForDashboard<T extends DashboardListingBucketRow>(
  shopId: string,
  allRows: T[],
  adminItems: AdminBaselineRow[],
): {
  live: GroupedDashboardListing<T>[];
  request: GroupedDashboardListing<T>[];
  removed: GroupedDashboardListing<T>[];
} {
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
  const g = (bucket: T[]) =>
    adminItems.length > 0
      ? groupLegacyBaselineVariantListingRows(shopId, bucket, adminItems)
      : bucket.map((row) => ({ kind: "single" as const, row }));
  return { live: g(live), request: g(request), removed: g(removed) };
}
