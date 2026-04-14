/**
 * One-off: clear Removed-items tracking for shop listings tied to specific catalog product names.
 * Run: npx tsx scripts/dismiss-removed-listings-by-product-names.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/** Exact Product.name values as shown in admin Removed items (catalog column). */
const PRODUCT_NAMES = [
  "The Original - Canvas Print (various sizes)",
  "The Original - Deskpad / Mousepad",
  "Where is my Tribute? Mug (11oz, 15oz)",
  "Make Yourself Useful Mug (11oz, 15oz)",
  "Piggy Mug (11oz, 15oz)",
  "The Original - Magnet",
  "Blue Hands Surreal Art Mug | Black Ceramic Coffee Cup",
  "Heart - Heart Keychain",
  "Stockings - Body Pillow",
  "Fuck You Pay Me Mug (11oz & 15oz)",
  "Pathetic Mug (11oz, 15oz)",
  "Loser Mug (11oz & 15oz)",
  "The Original - Throw Pillow",
  "The Original - Playing Card Deck",
  "The Original - Glossy Poster",
  "The Original - Body Pillow",
] as const;

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { in: [...PRODUCT_NAMES] } },
    select: { id: true, name: true },
  });
  const missing = PRODUCT_NAMES.filter((n) => !products.some((p) => p.name === n));
  if (missing.length > 0) {
    console.warn("No Product rows for these names (check spelling in DB):", missing);
  }
  if (products.length === 0) {
    console.log("No matching products — nothing to update.");
    return;
  }

  const result = await prisma.shopListing.updateMany({
    where: {
      removedFromListingRequestsAt: { not: null },
      productId: { in: products.map((p) => p.id) },
    },
    data: {
      removedFromListingRequestsAt: null,
      adminListingRemovalNotes: null,
    },
  });

  console.log(
    `Updated ${result.count} shop listing(s) across ${products.length} product(s). Matched product names:`,
    products.map((p) => p.name),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
