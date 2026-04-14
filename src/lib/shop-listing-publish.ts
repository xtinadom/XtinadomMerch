import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Storefront queries require `product.active`. Baseline stub products start inactive; when a shop
 * listing goes live we must activate the product or the dashboard shows “Live” while `/s/...` stays empty.
 */
export async function activateProductWhenShopListingGoesLive(
  productId: string,
  shopSlug: string,
): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: { active: true },
  });
  revalidatePath(`/s/${shopSlug}`);
}
