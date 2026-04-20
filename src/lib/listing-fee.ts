import { ListingRequestStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  LISTING_FEE_FREE_SLOT_COUNT,
  isFounderUnlimitedFreeListingsShop,
  listingFeeCentsForOrdinal,
} from "@/lib/marketplace-constants";

/**
 * Sets `listingFeePaidAt` for free-slot listings (by createdAt, then id) when still null, so admin approval
 * does not require payment. Founder shop gets all listings waived.
 */
export async function syncFreeListingFeeWaivers(shopId: string): Promise<void> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { slug: true, listingFeeBonusFreeSlots: true },
  });
  const bonus = Math.max(0, shop?.listingFeeBonusFreeSlots ?? 0);
  const maxFreeOrdinals =
    shop && isFounderUnlimitedFreeListingsShop(shop.slug)
      ? Number.POSITIVE_INFINITY
      : LISTING_FEE_FREE_SLOT_COUNT + bonus;

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

/**
 * After creating a listing as `submitted`, if it still owes a publication fee, move it back to `draft`
 * so the queue never contains unpaid fee listings.
 */
export async function downgradeSubmittedToDraftIfListingFeeUnpaid(
  shopId: string,
  shopSlug: string,
  listingId: string,
): Promise<{ downgraded: boolean; message?: string }> {
  await syncFreeListingFeeWaivers(shopId);
  const shopRow = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { listingFeeBonusFreeSlots: true },
  });
  const bonus = Math.max(0, shopRow?.listingFeeBonusFreeSlots ?? 0);
  const row = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId },
    select: { requestStatus: true, listingFeePaidAt: true },
  });
  if (!row || row.requestStatus !== ListingRequestStatus.submitted) {
    return { downgraded: false };
  }
  const ordinal = await getListingOrdinal(listingId, shopId);
  if (ordinal === null) return { downgraded: false };
  const fee = listingFeeCentsForOrdinal(ordinal, shopSlug, bonus);
  if (fee <= 0 || row.listingFeePaidAt != null) {
    return { downgraded: false };
  }
  await prisma.shopListing.update({
    where: { id: listingId },
    data: { requestStatus: ListingRequestStatus.draft },
  });
  return {
    downgraded: true,
    message:
      "Your listing was saved as a draft. Pay the publication fee on the Listings tab, then use Submit for admin approval.",
  };
}
