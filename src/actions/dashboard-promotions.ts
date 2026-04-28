"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import {
  PLATFORM_SHOP_SLUG,
} from "@/lib/marketplace-constants";
import { ListingRequestStatus, PromotionPurchaseStatus } from "@/generated/prisma/enums";
import { shopStripeConnectReadyForListingCharges } from "@/lib/shop-stripe-connect-gate";
import { ensureListingFeeStripeConnectNotice } from "@/lib/listing-fee-connect-notice";
import { fulfillPromotionPurchasePaidIfPending } from "@/lib/promotion-fulfillment";
import {
  parsePromotionKind,
  promotionKindRequiresListing,
  promotionPriceCentsForKind,
} from "@/lib/promotions";

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

async function assertShopListingLiveForPromotion(
  shopId: string,
  listingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId },
    select: {
      active: true,
      requestStatus: true,
    },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (!listing.active || listing.requestStatus === ListingRequestStatus.rejected) {
    return { ok: false, error: "Choose a live listing from your storefront." };
  }
  return { ok: true };
}

export type StartPromotionPurchaseIntentResult =
  | { ok: true; clientSecret: string; purchaseId: string }
  | { ok: false; error: string };

export async function startPromotionPurchaseIntent(input: {
  promotionKind: string;
  shopListingId?: string | null;
}): Promise<StartPromotionPurchaseIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const kind = parsePromotionKind(input.promotionKind);
  if (!kind) return { ok: false, error: "Invalid promotion type." };

  const listingIdRaw = String(input.shopListingId ?? "").trim();
  const needsListing = promotionKindRequiresListing(kind);
  if (needsListing && !listingIdRaw) {
    return { ok: false, error: "Select a listing for this promotion." };
  }
  if (!needsListing && listingIdRaw) {
    return { ok: false, error: "This promotion applies to your shop, not a single listing." };
  }

  let shopListingId: string | null = null;
  if (needsListing) {
    const gate = await assertShopListingLiveForPromotion(shop.id, listingIdRaw);
    if (!gate.ok) return gate;
    shopListingId = listingIdRaw;
  }

  const amountCents = promotionPriceCentsForKind(kind);
  if (amountCents <= 0) return { ok: false, error: "Invalid promotion price." };

  if (isMockCheckoutEnabled()) {
    return {
      ok: false,
      error: "Mock checkout is enabled — use the mock pay button instead of card entry.",
    };
  }

  if (!shopStripeConnectReadyForListingCharges(shop)) {
    await ensureListingFeeStripeConnectNotice(shop.id);
    return {
      ok: false,
      error:
        "Finish Stripe Connect on the Onboarding tab (charges and payouts enabled) before purchasing promotions.",
    };
  }

  const purchase = await prisma.promotionPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      kind,
      shopListingId,
      amountCents,
      currency: "usd",
      status: PromotionPurchaseStatus.pending,
    },
  });

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        kind: "promotion",
        promotionPurchaseId: purchase.id,
        shopId: shop.id,
        promotionKind: kind,
        ...(shopListingId ? { shopListingId } : {}),
        amountCents: String(amountCents),
      },
    });

    const clientSecret = paymentIntent.client_secret;
    if (!clientSecret) {
      await prisma.promotionPurchase.update({
        where: { id: purchase.id },
        data: { status: PromotionPurchaseStatus.failed },
      });
      return { ok: false, error: "Stripe did not return a client secret." };
    }

    await prisma.promotionPurchase.update({
      where: { id: purchase.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return { ok: true, clientSecret, purchaseId: purchase.id };
  } catch {
    await prisma.promotionPurchase.update({
      where: { id: purchase.id },
      data: { status: PromotionPurchaseStatus.failed },
    });
    return { ok: false, error: "Could not start payment. Try again." };
  }
}

export type FinalizePromotionPurchaseIntentResult = { ok: true } | { ok: false; error: string };

export async function finalizePromotionPurchaseIntent(
  paymentIntentId: string,
): Promise<FinalizePromotionPurchaseIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const piId = paymentIntentId.trim();
  if (!piId) return { ok: false, error: "Missing payment confirmation." };

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(piId, {
    expand: ["latest_charge"],
  });

  if (pi.metadata?.kind !== "promotion") {
    return { ok: false, error: "This payment is not a promotion purchase." };
  }
  const metaShopId = pi.metadata.shopId;
  if (metaShopId && metaShopId !== shop.id) {
    return { ok: false, error: "This payment does not belong to your shop." };
  }

  const purchaseId = pi.metadata.promotionPurchaseId;
  if (!purchaseId) return { ok: false, error: "Invalid payment metadata." };

  const purchase = await prisma.promotionPurchase.findFirst({
    where: { id: purchaseId, shopId: shop.id },
    select: {
      id: true,
      status: true,
      amountCents: true,
      kind: true,
    },
  });
  if (!purchase) return { ok: false, error: "Promotion purchase not found." };
  if (purchase.status === PromotionPurchaseStatus.paid) return { ok: true };

  if (purchase.status !== PromotionPurchaseStatus.pending) {
    return { ok: false, error: "This promotion purchase is no longer pending." };
  }

  if (pi.status !== "succeeded") {
    return { ok: false, error: `Payment is not complete yet (status: ${pi.status}).` };
  }

  if (pi.amount !== purchase.amountCents) {
    return { ok: false, error: "Payment amount does not match the promotion price." };
  }

  const chargeRaw = pi.latest_charge;
  const chargeId =
    typeof chargeRaw === "string"
      ? chargeRaw
      : chargeRaw && typeof chargeRaw === "object" && "id" in chargeRaw
        ? String((chargeRaw as { id: string }).id)
        : null;

  await fulfillPromotionPurchasePaidIfPending(purchase.id, {
    paymentIntentId: pi.id,
    chargeId,
    paidAmountCents: pi.amount,
  });
  return { ok: true };
}

export async function dashboardMockPayPromotion(formData: FormData) {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) return;

  const kind = parsePromotionKind(String(formData.get("promotionKind") ?? ""));
  if (!kind) return;

  const listingIdRaw = String(formData.get("shopListingId") ?? "").trim();
  const needsListing = promotionKindRequiresListing(kind);
  if (needsListing && !listingIdRaw) return;
  if (!needsListing && listingIdRaw) return;

  let shopListingId: string | null = null;
  if (needsListing) {
    const gate = await assertShopListingLiveForPromotion(shop.id, listingIdRaw);
    if (!gate.ok) return;
    shopListingId = listingIdRaw;
  }

  if (!isMockCheckoutEnabled()) {
    redirect("/dashboard?promo=err&promoErr=mock_only");
  }

  const amountCents = promotionPriceCentsForKind(kind);
  if (amountCents <= 0) return;

  await prisma.promotionPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      kind,
      shopListingId,
      amountCents,
      currency: "usd",
      status: PromotionPurchaseStatus.paid,
      paidAt: new Date(),
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?promo=ok");
}
