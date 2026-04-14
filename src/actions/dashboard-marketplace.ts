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
  listingFeeCentsForOrdinal,
  PLATFORM_SHOP_SLUG,
} from "@/lib/marketplace-constants";
import { getListingOrdinal } from "@/lib/listing-fee";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import {
  deleteShopListingRequestImagesFromR2,
  shopListingRequestImageUrlStrings,
} from "@/lib/r2-upload";
import { activateProductWhenShopListingGoesLive } from "@/lib/shop-listing-publish";

const REQUEST_ITEM_NAME_MAX = 120;

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
  if (
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null
  ) {
    return { ok: false };
  }
  if (
    listing.requestStatus !== ListingRequestStatus.draft &&
    listing.requestStatus !== ListingRequestStatus.approved
  ) {
    return { ok: false };
  }

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

export async function dashboardUpdateListingItemName(
  formData: FormData,
): Promise<{ ok: boolean }> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const raw = String(formData.get("requestItemName") ?? "");
  if (!listingId) return { ok: false };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
    include: { product: true },
  });
  if (!listing) return { ok: false };
  if (
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null
  ) {
    return { ok: false };
  }
  if (
    listing.requestStatus !== ListingRequestStatus.draft &&
    listing.requestStatus !== ListingRequestStatus.approved
  ) {
    return { ok: false };
  }

  const trimmed = raw.trim();
  const catalog = listing.product.name.trim();
  let requestItemName: string | null;
  if (!trimmed || trimmed === catalog) {
    requestItemName = null;
  } else if (trimmed.length > REQUEST_ITEM_NAME_MAX) {
    return { ok: false };
  } else {
    requestItemName = trimmed;
  }

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { requestItemName },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  return { ok: true };
}

/** Takes an approved, live listing off the creator storefront (distinct from admin freeze). */
export async function dashboardCreatorRemoveListingFromShop(formData: FormData): Promise<void> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) return;

  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: shop.id },
    select: {
      id: true,
      requestStatus: true,
      active: true,
      adminRemovedFromShopAt: true,
      creatorRemovedFromShopAt: true,
      requestImages: true,
    },
  });
  if (!listing) return;
  if (listing.requestStatus !== ListingRequestStatus.approved) return;
  if (!listing.active) return;
  if (listing.adminRemovedFromShopAt != null) return;
  if (listing.creatorRemovedFromShopAt != null) return;

  const requestImageUrls = shopListingRequestImageUrlStrings(listing.requestImages);
  await deleteShopListingRequestImagesFromR2(shop.id, requestImageUrls);

  await prisma.$transaction(async (tx) => {
    await tx.shopListing.update({
      where: { id: listingId },
      data: {
        active: false,
        featuredOnShop: false,
        featuredForHome: false,
        creatorRemovedFromShopAt: new Date(),
        requestImages: [],
      },
    });
    if (shop.homeFeaturedListingId === listingId) {
      await tx.shop.update({
        where: { id: shop.id },
        data: { homeFeaturedListingId: null },
      });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
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
  if (listing.requestStatus !== ListingRequestStatus.draft) {
    return { ok: false };
  }
  if (listing.creatorRemovedFromShopAt != null) {
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
    select: {
      id: true,
      productId: true,
      listingFeePaidAt: true,
      requestStatus: true,
      active: true,
      creatorRemovedFromShopAt: true,
      adminRemovedFromShopAt: true,
    },
  });
  if (!listing || listing.listingFeePaidAt) return;
  if (listing.requestStatus !== ListingRequestStatus.approved) return;
  if (listing.creatorRemovedFromShopAt != null) return;

  const ordinal = await getListingOrdinal(listingId, shop.id);
  if (ordinal === null) return;
  const feeCents = listingFeeCentsForOrdinal(ordinal, shop.slug);
  const publishAfterFee =
    listing.requestStatus === ListingRequestStatus.approved &&
    !listing.active &&
    listing.adminRemovedFromShopAt == null &&
    listing.creatorRemovedFromShopAt == null;

  if (feeCents === 0) {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: {
        listingFeePaidAt: new Date(),
        ...(publishAfterFee ? { active: true } : {}),
      },
    });
    if (publishAfterFee) {
      await activateProductWhenShopListingGoesLive(listing.productId, shop.slug);
      await prisma.shopOwnerNotice.create({
        data: {
          shopId: shop.id,
          kind: "listing_fee_paid",
          body:
            "Your listing publication fee was received. That listing is now live in your shop.",
        },
      });
    }
    revalidatePath("/dashboard");
    redirect("/dashboard?fee=ok");
  }

  if (isMockCheckoutEnabled()) {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: {
        listingFeePaidAt: new Date(),
        ...(publishAfterFee ? { active: true } : {}),
      },
    });
    if (publishAfterFee) {
      await activateProductWhenShopListingGoesLive(listing.productId, shop.slug);
      await prisma.shopOwnerNotice.create({
        data: {
          shopId: shop.id,
          kind: "listing_fee_paid",
          body:
            "Your listing publication fee was received. That listing is now live in your shop.",
        },
      });
    }
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
          unit_amount: feeCents,
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
