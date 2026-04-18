/**
 * One-off: delete ShopListing rows still in the admin listing-requests pipeline
 * (submitted, images_ok, printify_item_created). Keeps draft, approved, and rejected rows.
 *
 * Safety:
 * - OrderLine.shopListingId is SetNull on listing delete (orders keep productId).
 * - ShopOwnerNotice.relatedListingId is SetNull on listing delete.
 * - Shop.homeFeaturedListingId must not reference a deleted row — Prisma relation uses onDelete SetNull from Shop → ShopListing when the listing is removed (clear featured first if needed).
 *
 * Run (destructive): npx tsx scripts/purge-in-queue-listing-requests.ts
 * Dry run (log only): DRY_RUN=1 npx tsx scripts/purge-in-queue-listing-requests.ts
 */
import "dotenv/config";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";

const IN_QUEUE: ListingRequestStatus[] = [
  ListingRequestStatus.submitted,
  ListingRequestStatus.images_ok,
  ListingRequestStatus.printify_item_created,
];

async function main() {
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

  const candidates = await prisma.shopListing.findMany({
    where: { requestStatus: { in: IN_QUEUE } },
    select: {
      id: true,
      shopId: true,
      productId: true,
      requestStatus: true,
    },
  });

  if (candidates.length === 0) {
    console.log("No in-queue listing rows to delete.");
    return;
  }

  const ids = candidates.map((c) => c.id);

  const shopsPointing = await prisma.shop.findMany({
    where: { homeFeaturedListingId: { in: ids } },
    select: { id: true, slug: true, homeFeaturedListingId: true },
  });

  console.log(
    `Found ${candidates.length} ShopListing row(s) with requestStatus in [submitted, images_ok, printify_item_created].`,
  );
  if (shopsPointing.length > 0) {
    console.log(
      `Shops with featured listing among these (will clear before delete): ${shopsPointing.length}`,
      shopsPointing.map((s) => s.slug),
    );
  }

  if (dryRun) {
    console.log("DRY_RUN=1 — no deletes performed. IDs (first 20):", ids.slice(0, 20));
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (shopsPointing.length > 0) {
      await tx.shop.updateMany({
        where: { homeFeaturedListingId: { in: ids } },
        data: { homeFeaturedListingId: null },
      });
    }

    const deleted = await tx.shopListing.deleteMany({
      where: { id: { in: ids } },
    });

    if (deleted.count !== ids.length) {
      throw new Error(`Expected to delete ${ids.length} rows, deleted ${deleted.count}`);
    }
  });

  console.log(`Deleted ${ids.length} ShopListing row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
