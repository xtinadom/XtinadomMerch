import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import { activateProductWhenShopListingGoesLive } from "@/lib/shop-listing-publish";

/**
 * Marks a listing fee as paid when Stripe confirms payment (Checkout or PaymentIntent).
 * Idempotent: no-op if `listingFeePaidAt` is already set.
 * @returns true when this listing was updated (first time).
 */
export async function fulfillListingFeeForShopListingIfUnpaid(
  listingId: string,
  options?: { paidPublicationFeeCents?: number },
): Promise<boolean> {
  const row = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: {
      listingFeePaidAt: true,
      requestStatus: true,
      active: true,
      shopId: true,
      productId: true,
      adminRemovedFromShopAt: true,
      shop: { select: { slug: true } },
    },
  });
  if (!row || row.listingFeePaidAt != null) return false;

  const publishAfterFee =
    row.requestStatus === ListingRequestStatus.approved &&
    !row.active &&
    row.adminRemovedFromShopAt == null;
  const statusBefore = row.requestStatus;

  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      listingFeePaidAt: new Date(),
      ...(options?.paidPublicationFeeCents !== undefined
        ? { listingPublicationFeePaidCents: options.paidPublicationFeeCents }
        : {}),
      ...(publishAfterFee ? { active: true } : {}),
    },
  });

  if (publishAfterFee) {
    await activateProductWhenShopListingGoesLive(row.productId, row.shop.slug);
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: row.shopId,
        kind: "listing_fee_paid",
        body:
          "Your listing publication fee was received. That listing is now live in your shop.",
      },
    });
    revalidatePath("/dashboard");
  } else if (statusBefore === ListingRequestStatus.draft) {
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: row.shopId,
        kind: "listing_fee_paid",
        body:
          "Your listing publication fee was received. Open the Listings tab and submit that draft for admin review when you are ready.",
      },
    });
    revalidatePath("/dashboard");
  } else if (
    statusBefore === ListingRequestStatus.submitted ||
    statusBefore === ListingRequestStatus.images_ok ||
    statusBefore === ListingRequestStatus.printify_item_created
  ) {
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: row.shopId,
        kind: "listing_fee_paid",
        body: "Your listing publication fee was received. Admin review continues as usual.",
      },
    });
    revalidatePath("/dashboard");
  }

  return true;
}
