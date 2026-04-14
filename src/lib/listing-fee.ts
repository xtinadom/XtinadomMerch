import { prisma } from "@/lib/prisma";
import {
  LISTING_FEE_FREE_SLOT_COUNT,
  isFounderUnlimitedFreeListingsShop,
} from "@/lib/marketplace-constants";

/**
 * Sets `listingFeePaidAt` for free-slot listings (by createdAt, then id) when still null, so admin approval
 * does not require payment. Founder shop gets all listings waived.
 */
export async function syncFreeListingFeeWaivers(shopId: string): Promise<void> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { slug: true },
  });
  const maxFreeOrdinals =
    shop && isFounderUnlimitedFreeListingsShop(shop.slug)
      ? Number.POSITIVE_INFINITY
      : LISTING_FEE_FREE_SLOT_COUNT;

  const rows = await prisma.shopListing.findMany({
    where: { shopId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, listingFeePaidAt: true },
  });
  const now = new Date();
  for (let i = 0; i < rows.length; i++) {
    if (i + 1 <= maxFreeOrdinals && !rows[i].listingFeePaidAt) {
      await prisma.shopListing.update({
        where: { id: rows[i].id },
        data: { listingFeePaidAt: now },
      });
    }
  }
}

export async function getListingOrdinal(
  listingId: string,
  shopId: string,
): Promise<number | null> {
  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId },
    select: { id: true },
  });
  if (!listing) return null;
  const rows = await prisma.shopListing.findMany({
    where: { shopId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const idx = rows.findIndex((r) => r.id === listingId);
  return idx < 0 ? null : idx + 1;
}
