"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";

const CONFIRM_PHRASE = "DELETE SALES";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

/**
 * Deletes all orders (and cascaded order lines / fulfillment jobs). Optionally clears listing
 * publication-fee timestamps on every `ShopListing` (destructive). Blocked in production unless
 * `ALLOW_ADMIN_CLEAR_SALES_HISTORY=true`.
 */
export async function adminClearPlatformSalesHistoryAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_ADMIN_CLEAR_SALES_HISTORY?.trim() !== "true"
  ) {
    return {
      ok: false,
      error:
        "Clearing sales history is disabled in production. Set ALLOW_ADMIN_CLEAR_SALES_HISTORY=true to allow.",
    };
  }

  const confirm = String(formData.get("confirmPhrase") ?? "").trim();
  if (confirm !== CONFIRM_PHRASE) {
    return { ok: false, error: `Type ${CONFIRM_PHRASE} exactly to confirm.` };
  }

  const resetListingFees =
    formData.get("resetListingPublicationFees") === "on" ||
    String(formData.get("resetListingPublicationFees") ?? "") === "true";

  await prisma.$transaction(async (tx) => {
    await tx.order.deleteMany({});
    if (resetListingFees) {
      await tx.shopListing.updateMany({
        data: {
          listingFeePaidAt: null,
          listingPublicationFeePaidCents: null,
        },
      });
    }
  });

  revalidateAdminViews();
  revalidatePath("/admin");
  return { ok: true };
}
