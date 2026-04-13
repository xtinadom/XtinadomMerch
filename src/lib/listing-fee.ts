import { prisma } from "@/lib/prisma";
import { LISTING_FEE_FREE_SLOT_COUNT } from "@/lib/marketplace-constants";

/**
 * Sets `listingFeePaidAt` for the first {@link LISTING_FEE_FREE_SLOT_COUNT} listings (by createdAt, then id)
 * when it is still null, so admin approval does not require payment for free slots.
 */
export async function syncFreeListingFeeWaivers(shopId: string): Promise<void> {
  const rows = await prisma.shopListing.findMany({
    where: { shopId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, listingFeePaidAt: true },
  });
  const now = new Date();
  for (let i = 0; i < rows.length; i++) {
    if (i + 1 <= LISTING_FEE_FREE_SLOT_COUNT && !rows[i].listingFeePaidAt) {
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
