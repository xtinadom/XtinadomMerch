"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getShopOwnerSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import {
  listingFeeCentsForOrdinal,
  PLATFORM_SHOP_SLUG,
  SHOP_LISTING_MAX_PRICE_CENTS,
  shopListingMaxPriceUsdLabel,
} from "@/lib/marketplace-constants";
import { getListingOrdinal, syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import {
  deleteShopListingRequestImagesFromR2,
  deleteShopListingSupplementObject,
  isR2UploadConfigured,
  listingSupplementImageUrlToObjectKey,
  putPublicR2Object,
  shopListingSupplementImageObjectKey,
  shopListingRequestImageUrlStrings,
} from "@/lib/r2-upload";
import { compressShopListingSupplementPhotoWebp } from "@/lib/shop-setup-image";
import { fulfillListingFeeForShopListingIfUnpaid } from "@/lib/listing-fee-fulfillment";
import { ensureListingFeeStripeConnectNotice } from "@/lib/listing-fee-connect-notice";
import { shopStripeConnectReadyForListingCharges } from "@/lib/shop-stripe-connect-gate";
import { printifyVariantShopFloorCents } from "@/lib/listing-cart-price";
import { listingCatalogUrlsForPersist } from "@/lib/product-media";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { canStartStripeConnect, computeShopOnboardingSteps } from "@/lib/shop-onboarding-gate";
import { normalizeSearchKeywords, SEARCH_KEYWORDS_MAX } from "@/lib/search-keywords-normalize";

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

const REQUEST_ITEM_NAME_MAX = 120;
/** `ShopListing.storefrontItemBlurb` — one-line pitch on the public PDP (tweet-length cap). */
const STOREFRONT_ITEM_BLURB_MAX = 280;
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

export type DashboardUpdateListingPriceResult = { ok: true } | { ok: false; error: string };

export async function dashboardUpdateListingPrice(
  formData: FormData,
): Promise<DashboardUpdateListingPriceResult> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const dollars = String(formData.get("priceDollars") ?? "").trim();
  if (!listingId) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
    include: { product: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null
  ) {
    return { ok: false, error: "This listing can't be edited." };
  }
  if (
    listing.requestStatus !== ListingRequestStatus.draft &&
    listing.requestStatus !== ListingRequestStatus.approved
  ) {
    return {
      ok: false,
      error:
        "Price can't be changed while this request is in review. Wait for approval, or finish editing your draft.",
    };
  }

  const parsed = parseFloat(dollars.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, error: "Enter a valid USD amount." };
  }
  const cents = Math.round(parsed * 100);
  const p = listing.product;
  const minCents = printifyVariantShopFloorCents(
    p,
    getPrintifyVariantsForProduct(p)[0]?.priceCents ?? p.priceCents,
  );
  if (cents < minCents) {
    return {
      ok: false,
      error: `Price must be at least ${formatUsdFromCents(minCents)} for this item.`,
    };
  }
  if (cents > SHOP_LISTING_MAX_PRICE_CENTS) {
    return {
      ok: false,
      error: `Price cannot exceed ${shopListingMaxPriceUsdLabel()} per listing.`,
    };
  }

  if (getPrintifyVariantsForProduct(listing.product).length > 1) {
    return { ok: false, error: "Use per-option prices for this product." };
  }

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { priceCents: cents, listingPrintifyVariantPrices: Prisma.DbNull },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  return { ok: true };
}

export type SaveVariantPricesResult =
  | { ok: true }
  | { ok: false; error: string };

export async function dashboardUpdateListingVariantPrices(
  formData: FormData,
): Promise<SaveVariantPricesResult> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const rawJson = String(formData.get("variantPricesJson") ?? "").trim();
  if (!listingId || !rawJson) {
    return { ok: false, error: "Missing listing or price data. Try again." };
  }

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
    include: { product: true },
  });
  if (!listing) {
    return { ok: false, error: "Listing not found." };
  }
  if (
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null
  ) {
    return { ok: false, error: "This listing can't be edited." };
  }
  if (listing.adminRemovedFromShopAt != null) {
    return { ok: false, error: "This listing is frozen by the platform until support clears it." };
  }
  if (
    listing.requestStatus !== ListingRequestStatus.draft &&
    listing.requestStatus !== ListingRequestStatus.approved
  ) {
    return {
      ok: false,
      error:
        "Prices can't be changed while this request is in review. Wait for approval, or finish editing your draft.",
    };
  }
  const variants = getPrintifyVariantsForProduct(listing.product);
  if (variants.length <= 1) {
    return { ok: false, error: "This product doesn't have multiple variants to price separately." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawJson) as unknown;
  } catch {
    return { ok: false, error: "Invalid price data. Try again." };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Invalid price data. Try again." };
  }
  const obj = payload as Record<string, unknown>;

  const centsById: Record<string, number> = {};
  const maxLabel = shopListingMaxPriceUsdLabel();
  for (const v of variants) {
    const minAllowed = printifyVariantShopFloorCents(listing.product, v.priceCents);
    if (minAllowed > SHOP_LISTING_MAX_PRICE_CENTS) {
      return {
        ok: false,
        error: `"${v.title}" requires at least ${formatUsdFromCents(minAllowed)}, which is above the ${maxLabel} listing cap. Contact support if you need an exception.`,
      };
    }
    const raw = obj[v.id];
    const dollars =
      typeof raw === "string"
        ? parseFloat(raw.replace(/[^0-9.]/g, ""))
        : typeof raw === "number"
          ? raw
          : NaN;
    if (!Number.isFinite(dollars) || dollars < 0) {
      return {
        ok: false,
        error: "Enter a valid USD amount for every option (e.g. 24.99).",
      };
    }
    const cents = Math.round(dollars * 100);
    if (cents < minAllowed) {
      const platformHigher =
        listing.product.minPriceCents > 0 &&
        listing.product.minPriceCents > v.priceCents;
      return {
        ok: false,
        error: `"${v.title}" must be at least ${formatUsdFromCents(minAllowed)} (this size's synced Printify retail${platformHigher ? "; platform minimum is higher than this size's base" : ""}).`,
      };
    }
    if (cents > SHOP_LISTING_MAX_PRICE_CENTS) {
      return {
        ok: false,
        error: `"${v.title}" cannot exceed ${maxLabel} per listing.`,
      };
    }
    centsById[v.id] = cents;
  }

  const minListing = Math.min(...Object.values(centsById));

  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      listingPrintifyVariantPrices: centsById as Prisma.InputJsonValue,
      priceCents: minListing,
    },
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
  const pslug = listing.product.slug;
  revalidatePath(`/product/${pslug}`);
  revalidatePath(`/s/${user.shop.slug}/product/${pslug}`);
  revalidatePath(`/embed/product/${pslug}`);
  return { ok: true };
}

export async function dashboardUpdateListingStorefrontBlurb(
  formData: FormData,
): Promise<{ ok: boolean }> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const raw = String(formData.get("storefrontItemBlurb") ?? "");
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
  if (trimmed.length > STOREFRONT_ITEM_BLURB_MAX) return { ok: false };
  const storefrontItemBlurb = trimmed.length === 0 ? null : trimmed;

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { storefrontItemBlurb },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  const pslug = listing.product.slug;
  revalidatePath(`/product/${pslug}`);
  revalidatePath(`/s/${user.shop.slug}/product/${pslug}`);
  revalidatePath(`/embed/product/${pslug}`);
  return { ok: true };
}

export async function dashboardUpdateListingSearchKeywords(
  formData: FormData,
): Promise<{ ok: boolean }> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const raw = String(formData.get("listingSearchKeywords") ?? "");
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
  if (trimmed.length > SEARCH_KEYWORDS_MAX) return { ok: false };
  const listingSearchKeywords = normalizeSearchKeywords(raw);

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { listingSearchKeywords },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  const pslug = listing.product.slug;
  revalidatePath(`/product/${pslug}`);
  revalidatePath(`/s/${user.shop.slug}/product/${pslug}`);
  revalidatePath(`/embed/product/${pslug}`);
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
  await deleteShopListingSupplementObject(shop.id, listingId);

  await prisma.$transaction(async (tx) => {
    await tx.shopListing.update({
      where: { id: listingId },
      data: {
        active: false,
        featuredOnShop: false,
        featuredForHome: false,
        creatorRemovedFromShopAt: new Date(),
        requestImages: [],
        ownerSupplementImageUrl: null,
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

export type DashboardSubmitListingRequestResult =
  | { ok: true }
  | { ok: false; error?: string };

export async function dashboardSubmitListingRequest(
  formData: FormData,
): Promise<DashboardSubmitListingRequestResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  const listingId = String(formData.get("listingId") ?? "").trim();
  const imagesText = String(formData.get("requestImageUrls") ?? "");
  if (!listingId) return { ok: false, error: "Missing listing." };
  if (String(formData.get("guidelinesAttestation") ?? "").trim() !== "1") {
    return {
      ok: false,
      error:
        "Confirm in the dialog that you have rights to your reference images and that they follow the item guidelines.",
    };
  }

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.requestStatus !== ListingRequestStatus.draft) {
    return { ok: false, error: "Only drafts can be submitted for review." };
  }
  if (listing.creatorRemovedFromShopAt != null) {
    return { ok: false, error: "This listing cannot be submitted." };
  }

  await syncFreeListingFeeWaivers(shop.id);
  const listingAfterSync = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
    select: { listingFeePaidAt: true },
  });
  const feePaid = listingAfterSync?.listingFeePaidAt != null;
  const ordinal = await getListingOrdinal(listingId, shop.id);
  if (ordinal !== null) {
    const feeCents = listingFeeCentsForOrdinal(ordinal, shop.slug, shop.listingFeeBonusFreeSlots ?? 0);
    if (feeCents > 0 && !feePaid) {
      revalidatePath("/dashboard");
      if (!shopStripeConnectReadyForListingCharges(shop)) {
        await ensureListingFeeStripeConnectNotice(shop.id);
        return {
          ok: false,
          error:
            "Finish Stripe Connect on the Onboarding tab (charges and payouts enabled) before you can pay the publication fee or submit this listing for review.",
        };
      }
      return {
        ok: false,
        error:
          "Pay the publication fee for this listing on the Listings tab before submitting for admin review.",
      };
    }
    if (feeCents > 0 && String(formData.get("feeChargeAttestation") ?? "").trim() !== "1") {
      return {
        ok: false,
        error:
          "Confirm the publication fee agreement in the dialog before submitting for admin review.",
      };
    }
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
      listingFeePaidAt: true,
      requestStatus: true,
      creatorRemovedFromShopAt: true,
      adminRemovedFromShopAt: true,
    },
  });
  if (!listing || listing.listingFeePaidAt) return;
  if (listing.creatorRemovedFromShopAt != null) return;
  if (listing.adminRemovedFromShopAt != null) return;

  const canPayListingFee =
    listing.requestStatus === ListingRequestStatus.draft ||
    listing.requestStatus === ListingRequestStatus.approved ||
    listing.requestStatus === ListingRequestStatus.submitted ||
    listing.requestStatus === ListingRequestStatus.images_ok ||
    listing.requestStatus === ListingRequestStatus.printify_item_created;
  if (!canPayListingFee) return;

  const ordinal = await getListingOrdinal(listingId, shop.id);
  if (ordinal === null) return;
  const feeCents = listingFeeCentsForOrdinal(ordinal, shop.slug, shop.listingFeeBonusFreeSlots ?? 0);

  if (feeCents === 0) {
    await fulfillListingFeeForShopListingIfUnpaid(listingId, {
      paidPublicationFeeCents: 0,
    });
    redirect("/dashboard?fee=ok");
  }

  if (isMockCheckoutEnabled()) {
    await fulfillListingFeeForShopListingIfUnpaid(listingId, {
      paidPublicationFeeCents: feeCents,
    });
    redirect("/dashboard?fee=ok");
  }

  redirect("/dashboard?fee=err&reason=listing_fee_use_card_on_listings_tab");
}

export type StartListingFeePaymentIntentResult =
  | { ok: true; clientSecret: string }
  | { ok: false; error: string };

export async function startListingFeePaymentIntent(
  listingId: string,
): Promise<StartListingFeePaymentIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  const id = listingId.trim();
  if (!id) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id, shopId: shop.id },
    select: {
      id: true,
      listingFeePaidAt: true,
      requestStatus: true,
      creatorRemovedFromShopAt: true,
      adminRemovedFromShopAt: true,
    },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.listingFeePaidAt) return { ok: false, error: "This listing fee is already paid." };
  if (listing.creatorRemovedFromShopAt != null || listing.adminRemovedFromShopAt != null) {
    return { ok: false, error: "This listing cannot be charged." };
  }

  const canPayListingFee =
    listing.requestStatus === ListingRequestStatus.draft ||
    listing.requestStatus === ListingRequestStatus.approved ||
    listing.requestStatus === ListingRequestStatus.submitted ||
    listing.requestStatus === ListingRequestStatus.images_ok ||
    listing.requestStatus === ListingRequestStatus.printify_item_created;
  if (!canPayListingFee) {
    return { ok: false, error: "Publication fees can only be paid for eligible listing rows." };
  }

  const ordinal = await getListingOrdinal(id, shop.id);
  if (ordinal === null) return { ok: false, error: "Listing not found." };
  const feeCents = listingFeeCentsForOrdinal(ordinal, shop.slug, shop.listingFeeBonusFreeSlots ?? 0);
  if (feeCents <= 0) return { ok: false, error: "No publication fee is due for this listing." };

  if (isMockCheckoutEnabled()) {
    return {
      ok: false,
      error: "Mock checkout is enabled on the server — use the mock pay button instead of card entry.",
    };
  }

  if (!shopStripeConnectReadyForListingCharges(shop)) {
    await ensureListingFeeStripeConnectNotice(shop.id);
    return {
      ok: false,
      error:
        "Finish Stripe Connect on the Onboarding tab (charges and payouts enabled) before paying publication fees.",
    };
  }

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: feeCents,
    currency: "usd",
    payment_method_types: ["card"],
    metadata: {
      kind: "listing_fee",
      shopListingId: listing.id,
      shopId: shop.id,
      feeCents: String(feeCents),
    },
  });

  const clientSecret = paymentIntent.client_secret;
  if (!clientSecret) return { ok: false, error: "Stripe did not return a client secret." };
  return { ok: true, clientSecret };
}

export type FinalizeListingFeePaymentIntentResult = { ok: true } | { ok: false; error: string };

export async function finalizeListingFeePaymentIntent(
  paymentIntentId: string,
): Promise<FinalizeListingFeePaymentIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  const piId = paymentIntentId.trim();
  if (!piId) return { ok: false, error: "Missing payment confirmation." };

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(piId);

  if (pi.metadata?.kind !== "listing_fee") {
    return { ok: false, error: "This payment is not a listing publication fee." };
  }
  const metaShopId = pi.metadata.shopId;
  if (metaShopId && metaShopId !== shop.id) {
    return { ok: false, error: "This payment does not belong to your shop." };
  }

  const listingId = pi.metadata.shopListingId;
  if (!listingId) return { ok: false, error: "Invalid payment metadata." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: shop.id },
    select: { id: true, listingFeePaidAt: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.listingFeePaidAt) return { ok: true };

  const ordinal = await getListingOrdinal(listingId, shop.id);
  if (ordinal === null) return { ok: false, error: "Listing not found." };
  const feeCents = listingFeeCentsForOrdinal(ordinal, shop.slug, shop.listingFeeBonusFreeSlots ?? 0);
  if (feeCents <= 0) return { ok: false, error: "No fee is configured for this listing." };
  if (pi.amount !== feeCents) {
    return { ok: false, error: "Payment amount does not match the current publication fee." };
  }

  if (pi.status !== "succeeded") {
    return { ok: false, error: `Payment is not complete yet (status: ${pi.status}).` };
  }

  await fulfillListingFeeForShopListingIfUnpaid(listingId, {
    paidPublicationFeeCents: pi.amount,
  });
  return { ok: true };
}

export async function dashboardStartStripeConnect() {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) return;

  const row = await prisma.shopUser.findUnique({
    where: { id: user.id },
    select: {
      emailVerifiedAt: true,
      shop: {
        select: {
          displayName: true,
          itemGuidelinesAcknowledgedAt: true,
          connectChargesEnabled: true,
          payoutsEnabled: true,
          listings: { select: { requestStatus: true, active: true } },
        },
      },
    },
  });
  if (!row?.shop) return;
  const steps = computeShopOnboardingSteps({
    displayName: row.shop.displayName,
    itemGuidelinesAcknowledgedAt: row.shop.itemGuidelinesAcknowledgedAt,
    emailVerifiedAt: row.emailVerifiedAt,
    listings: row.shop.listings,
    connectChargesEnabled: row.shop.connectChargesEnabled,
    payoutsEnabled: row.shop.payoutsEnabled,
  });
  if (!canStartStripeConnect(steps)) {
    redirect("/dashboard?dash=setup&connect=err&reason=onboarding_incomplete");
  }

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

type ListingSupplementActionResult = { ok: true } | { ok: false; error: string };

function listingEligibleForOwnerSupplementPhoto(listing: {
  requestStatus: ListingRequestStatus;
  creatorRemovedFromShopAt: Date | null;
  adminRemovedFromShopAt: Date | null;
}): boolean {
  if (listing.requestStatus !== ListingRequestStatus.approved) return false;
  if (listing.creatorRemovedFromShopAt != null) return false;
  if (listing.adminRemovedFromShopAt != null) return false;
  return true;
}

export async function dashboardUploadListingSupplementPhoto(
  formData: FormData,
): Promise<ListingSupplementActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  if (!isR2UploadConfigured()) {
    return {
      ok: false,
      error: "Image uploads are not configured (R2 env vars missing on the server).",
    };
  }

  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: shop.id },
    select: {
      id: true,
      requestStatus: true,
      creatorRemovedFromShopAt: true,
      adminRemovedFromShopAt: true,
    },
  });
  if (!listing || !listingEligibleForOwnerSupplementPhoto(listing)) {
    return { ok: false, error: "This listing cannot be updated." };
  }

  const file = formData.get("supplementPhoto");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: "Choose an image file to upload." };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { ok: false, error: "Image is too large before processing (max 20 MB)." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const webp = await compressShopListingSupplementPhotoWebp(buf);
  if (!webp) {
    return {
      ok: false,
      error: "Could not compress that image to under 100 KiB. Try a simpler or smaller photo.",
    };
  }

  const key = shopListingSupplementImageObjectKey(shop.id, listingId);
  const url = await putPublicR2Object({
    key,
    body: webp,
    contentType: "image/webp",
  });
  if (!listingSupplementImageUrlToObjectKey(url, shop.id, listingId)) {
    return {
      ok: false,
      error: "Upload URL validation failed. Try again or contact support.",
    };
  }

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { ownerSupplementImageUrl: url },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  return { ok: true };
}

export async function dashboardClearListingSupplementPhoto(
  formData: FormData,
): Promise<ListingSupplementActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: shop.id },
    select: {
      id: true,
      requestStatus: true,
      creatorRemovedFromShopAt: true,
      adminRemovedFromShopAt: true,
      ownerSupplementImageUrl: true,
    },
  });
  if (!listing || !listingEligibleForOwnerSupplementPhoto(listing)) {
    return { ok: false, error: "This listing cannot be updated." };
  }
  if (!listing.ownerSupplementImageUrl?.trim()) {
    return { ok: false, error: "There is no extra photo to remove." };
  }
  if (
    !listingSupplementImageUrlToObjectKey(
      listing.ownerSupplementImageUrl.trim(),
      shop.id,
      listingId,
    )
  ) {
    return {
      ok: false,
      error:
        "Only your uploaded extra photo can be removed here. Catalog and product images are managed by the platform.",
    };
  }

  await deleteShopListingSupplementObject(shop.id, listingId);
  await prisma.shopListing.update({
    where: { id: listingId },
    data: { ownerSupplementImageUrl: null },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  return { ok: true };
}

export type ListingCatalogImagesFormState = {
  ok: boolean;
  error: string | null;
};

const initialListingCatalogImagesFormState: ListingCatalogImagesFormState = {
  ok: false,
  error: null,
};

type ApplyCatalogImagesResult = { ok: true } | { ok: false; error: string };

async function applyListingStorefrontCatalogImages(
  formData: FormData,
): Promise<ApplyCatalogImagesResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const listingId = String(formData.get("listingId") ?? "").trim();
  const mode = String(formData.get("mode") ?? "subset").trim();
  if (!listingId) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: shop.id },
    include: { product: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null
  ) {
    return { ok: false, error: "This listing cannot be updated." };
  }
  if (listing.requestStatus !== ListingRequestStatus.approved) {
    return { ok: false, error: "Only approved listings can change storefront images." };
  }
  if (listing.adminRemovedFromShopAt != null) {
    return { ok: false, error: "This listing is frozen and cannot be edited." };
  }

  if (mode === "all") {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: { listingStorefrontCatalogImageUrls: Prisma.DbNull },
    });
  } else {
    const urls = formData
      .getAll("catalogUrl")
      .map((v) => String(v).trim())
      .filter(Boolean);
    const cleaned = listingCatalogUrlsForPersist(listing.product, urls);
    await prisma.shopListing.update({
      where: { id: listingId },
      data: { listingStorefrontCatalogImageUrls: cleaned },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  revalidatePath(`/s/${shop.slug}/product/${listing.product.slug}`);
  return { ok: true };
}

/** For `useActionState` on the dashboard listing card catalog image forms. */
export async function dashboardSetListingStorefrontCatalogImagesForm(
  _prev: ListingCatalogImagesFormState,
  formData: FormData,
): Promise<ListingCatalogImagesFormState> {
  try {
    const r = await applyListingStorefrontCatalogImages(formData);
    if (r.ok) return { ok: true, error: null };
    return { ok: false, error: r.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** @deprecated Prefer {@link dashboardSetListingStorefrontCatalogImagesForm} with useActionState */
export async function dashboardSetListingStorefrontCatalogImages(formData: FormData): Promise<void> {
  await applyListingStorefrontCatalogImages(formData);
}
