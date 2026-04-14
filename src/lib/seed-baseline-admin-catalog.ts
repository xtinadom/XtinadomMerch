import type { PrismaClient } from "@/generated/prisma/client";

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
export async function createBaselineAdminCatalogFromProducts(db: PrismaClient): Promise<number> {
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
