"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { PLATFORM_SHOP_SLUG, isFounderUnlimitedFreeListingsShop } from "@/lib/marketplace-constants";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import {
  lookupListingSlotPromoRule,
  normalizeListingSlotPromoCodeInput,
  parseListingSlotPromoCouponsFromEnv,
} from "@/lib/listing-slot-promo-coupons";
import type { RedeemListingSlotPromoState } from "@/lib/listing-slot-promo-redeem-state";
import { Prisma } from "@/generated/prisma/client";

async function requireShopOwner() {
  const session = await getShopOwnerSession();
  if (!session.shopUserId) redirect("/dashboard/login");
  const user = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    include: { shop: true },
  });
  if (!user) {
    session.destroy();
    redirect("/dashboard/login");
  }
  return user;
}

/**
 * Redeems a server-configured listing-slot promo for the signed-in shop.
 * Configure coupons in `LISTING_SLOT_PROMO_COUPONS_JSON` (see `ListingSlotPromoRule` in
 * {@link parseListingSlotPromoCouponsFromEnv}): default is one redemption per shop per code;
 * optional `allowedShopSlug` + `unlimitedRedemptionsForAllowedShop` allow repeat redemptions for that shop only.
 */
export async function redeemListingSlotPromoCoupon(
  _prev: RedeemListingSlotPromoState,
  formData: FormData,
): Promise<RedeemListingSlotPromoState> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { status: "error", message: "Promo codes are not used for the platform catalog shop." };
  }
  if (isFounderUnlimitedFreeListingsShop(shop.slug)) {
    return {
      status: "error",
      message: "Your shop already publishes every listing without a publication fee.",
    };
  }

  const raw = String(formData.get("couponCode") ?? "");
  const normalized = normalizeListingSlotPromoCodeInput(raw);
  if (!normalized) {
    return { status: "error", message: "Enter a promo code." };
  }

  const coupons = parseListingSlotPromoCouponsFromEnv();
  const rule = lookupListingSlotPromoRule(coupons, normalized);
  if (!rule) {
    return { status: "error", message: "That code is not valid." };
  }

  if (rule.allowedShopSlug != null && shop.slug.toLowerCase() !== rule.allowedShopSlug) {
    return { status: "error", message: "That code is not valid." };
  }

  const allowRepeatSameShop = rule.unlimitedRedemptionsForAllowedShop === true;

  try {
    await prisma.$transaction(async (tx) => {
      if (!allowRepeatSameShop) {
        const existing = await tx.shopListingSlotPromoRedemption.findFirst({
          where: {
            shopId: shop.id,
            couponCodeNormalized: normalized,
          },
        });
        if (existing) {
          throw new Error("already_redeemed");
        }
      }

      if (rule.maxRedemptions != null) {
        const used = await tx.shopListingSlotPromoRedemption.count({
          where: { couponCodeNormalized: normalized },
        });
        if (used >= rule.maxRedemptions) {
          throw new Error("promo_exhausted");
        }
      }

      await tx.shopListingSlotPromoRedemption.create({
        data: {
          shopId: shop.id,
          couponCodeNormalized: normalized,
          slotsGranted: rule.slots,
        },
      });
      await tx.shop.update({
        where: { id: shop.id },
        data: { listingFeeBonusFreeSlots: { increment: rule.slots } },
      });
    });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "already_redeemed") {
        return { status: "error", message: "You have already used this code on your shop." };
      }
      if (e.message === "promo_exhausted") {
        return { status: "error", message: "This promotion is no longer available." };
      }
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { status: "error", message: "You have already used this code on your shop." };
    }
    throw e;
  }

  await syncFreeListingFeeWaivers(shop.id);
  revalidatePath("/dashboard");

  const slotWord = rule.slots === 1 ? "listing" : "listings";
  return {
    status: "success",
    message: `Applied — you have ${rule.slots} extra free ${slotWord} toward publication fees.`,
  };
}
