import type { PrismaClient } from "@/generated/prisma/client";

type AdminBaselineDb = Pick<PrismaClient, "adminCatalogItem" | "product">;

/**
 * Product slugs created by `prisma/seed.ts`, in dashboard sort order.
 * Used to populate `AdminCatalogItem` when the admin “List” is empty.
 */
export const BASELINE_ADMIN_CATALOG_PRODUCT_SLUGS = [
  "ceramic-mug-photo",
  "canvas-print-12",
  "sample-used-item",
  "domme-tee",
  "domme-mug",
] as const;

/**
 * One row per matching Product: single-item picks (no variant JSON), linked to the storefront product.
 */
export async function createBaselineAdminCatalogFromProducts(db: AdminBaselineDb): Promise<number> {
  const slugs = [...BASELINE_ADMIN_CATALOG_PRODUCT_SLUGS];
  const rows = await db.product.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, name: true, priceCents: true, minPriceCents: true },
  });
  let sortOrder = 1;
  let created = 0;
  for (const slug of BASELINE_ADMIN_CATALOG_PRODUCT_SLUGS) {
    const p = rows.find((r) => r.slug === slug);
    if (!p) continue;
    const itemMinPriceCents = Math.max(p.priceCents, p.minPriceCents);
    await db.adminCatalogItem.create({
      data: {
        name: p.name,
        sortOrder: sortOrder++,
        variants: [],
        itemPlatformProductId: p.id,
        itemExampleListingUrl: `/product/${p.slug}`,
        itemMinPriceCents,
      },
    });
    created++;
  }
  return created;
}

/**
 * If `AdminCatalogItem` has no rows but sample `Product` rows exist (same slugs as seed), insert baseline
 * catalog rows so Admin List and creator dashboards match across environments after deploy.
 *
 * Cheap no-op when the table already has data. Uses a transaction-scoped advisory lock so two concurrent
 * “first” requests cannot duplicate rows.
 */
export async function ensureBaselineAdminCatalogIfEmpty(prisma: PrismaClient): Promise<void> {
  if ((await prisma.adminCatalogItem.count()) > 0) return;

  await prisma.$transaction(async (tx) => {
    // App-specific advisory lock keys (stable across deploys).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(47281903, 9002311)`;
    if ((await tx.adminCatalogItem.count()) > 0) return;
    await createBaselineAdminCatalogFromProducts(tx);
  });
}
