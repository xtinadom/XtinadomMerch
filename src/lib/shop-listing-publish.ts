import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncListingProductWithPrintifyCatalog } from "@/lib/shop-listing-printify-product-sync";

/**
 * Storefront queries require `product.active`. Baseline stub products start inactive; when a shop
 * listing goes live we must activate the product or the dashboard shows “Live” while `/s/...` stays empty.
 */
export async function activateProductWhenShopListingGoesLive(
  productId: string,
  shopSlug: string,
): Promise<void> {
  const listing = await prisma.shopListing.findFirst({
    where: { productId },
    select: {
      listingPrintifyProductId: true,
      listingPrintifyVariantId: true,
    },
  });
  if (listing?.listingPrintifyProductId?.trim()) {
    await syncListingProductWithPrintifyCatalog(productId, {
      listingPrintifyProductId: listing.listingPrintifyProductId,
      listingPrintifyVariantId: listing.listingPrintifyVariantId,
    });
  }

  await prisma.product.update({
    where: { id: productId },
    data: { active: true },
  });
  revalidatePath(`/s/${shopSlug}`);
}
