"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import {
  LISTING_FEE_CENTS,
  PLATFORM_SHOP_SLUG,
} from "@/lib/marketplace-constants";
import { ListingRequestStatus } from "@/generated/prisma/enums";

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

export async function dashboardUpdateListingPrice(
  formData: FormData,
): Promise<{ ok: boolean }> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const dollars = String(formData.get("priceDollars") ?? "").trim();
  if (!listingId) return { ok: false };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
    include: { product: true },
  });
  if (!listing) return { ok: false };

  const parsed = parseFloat(dollars.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return { ok: false };
  const cents = Math.round(parsed * 100);
  const minCents =
    listing.product.minPriceCents > 0
      ? listing.product.minPriceCents
      : listing.product.priceCents;
  if (cents < minCents) return { ok: false };

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { priceCents: cents },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  return { ok: true };
}

export async function dashboardSubmitListingRequest(
  formData: FormData,
): Promise<{ ok: boolean }> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const imagesText = String(formData.get("requestImageUrls") ?? "");
  if (!listingId) return { ok: false };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
  });
  if (!listing) return { ok: false };
  if (
    listing.requestStatus !== ListingRequestStatus.draft &&
    listing.requestStatus !== ListingRequestStatus.rejected
  ) {
    return { ok: false };
  }

  const urls = imagesText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);

  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      requestStatus: ListingRequestStatus.submitted,
      requestImages: urls.length ? urls : undefined,
    },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function dashboardPayListingFee(formData: FormData) {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) return;

  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: shop.id },
  });
  if (!listing || listing.listingFeePaidAt) return;

  if (isMockCheckoutEnabled()) {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: { listingFeePaidAt: new Date() },
    });
    revalidatePath("/dashboard");
    redirect("/dashboard?fee=ok");
  }

  const base = publicAppBaseUrl();
  if (!base) redirect("/dashboard?fee=err&reason=no_app_url");

  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: LISTING_FEE_CENTS,
          product_data: {
            name: "Listing publication fee",
            description: `Shop “${shop.displayName}” — one listing`,
          },
        },
      },
    ],
    metadata: {
      kind: "listing_fee",
      shopListingId: listing.id,
    },
    success_url: `${base}/dashboard?fee=ok`,
    cancel_url: `${base}/dashboard?fee=cancel`,
  });

  if (!checkoutSession.url) redirect("/dashboard?fee=err&reason=stripe");
  redirect(checkoutSession.url);
}

export async function dashboardStartStripeConnect() {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) return;

  const base = publicAppBaseUrl();
  if (!base) redirect("/dashboard?connect=err&reason=no_app_url");

  const stripe = getStripe();
  let accountId = shop.stripeConnectAccountId;
  if (!accountId) {
    const country =
      process.env.STRIPE_CONNECT_ACCOUNT_COUNTRY?.trim() || "US";
    const acct = await stripe.accounts.create({
      type: "express",
      country,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { shopId: shop.id },
    });
    accountId = acct.id;
    await prisma.shop.update({
      where: { id: shop.id },
      data: { stripeConnectAccountId: accountId },
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/dashboard?connect=refresh`,
    return_url: `${base}/dashboard?connect=return`,
    type: "account_onboarding",
  });

  redirect(link.url);
}
