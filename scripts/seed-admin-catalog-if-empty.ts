/**
 * Safe for production: if `AdminCatalogItem` has no rows, insert baseline rows
 * for each Product whose slug matches the repo seed (`BASELINE_ADMIN_CATALOG_PRODUCT_SLUGS`).
 *
 * Typical flow:
 *   npx vercel env pull .env.production.local --environment=production
 *   npm run db:seed:admin-catalog-if-empty
 *
 * Or set `DATABASE_URL` / `POSTGRES_PRISMA_URL` in the shell, then the same npm script.
 */
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.production.local", override: true });

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { createBaselineAdminCatalogFromProducts } = await import("../src/lib/seed-baseline-admin-catalog");

  try {
    const existing = await prisma.adminCatalogItem.count();
    if (existing > 0) {
      console.log(
        `[seed-admin-catalog-if-empty] Admin catalog already has ${existing} row(s); leaving unchanged.`,
      );
      return;
    }

    const created = await createBaselineAdminCatalogFromProducts(prisma);
    if (created === 0) {
      console.error(
        "[seed-admin-catalog-if-empty] No products matched baseline slugs. Add rows in Admin → List, or add Products whose slugs match src/lib/seed-baseline-admin-catalog.ts.",
      );
      process.exit(1);
    }

    console.log(`[seed-admin-catalog-if-empty] Created ${created} admin catalog row(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
