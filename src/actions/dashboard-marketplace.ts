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
  LISTING_FEE_CENTS,
  listingFeeCentsForOrdinal,
  PLATFORM_SHOP_SLUG,
} from "@/lib/marketplace-constants";
import { getListingOrdinal } from "@/lib/listing-fee";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";
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
import { activateProductWhenShopListingGoesLive } from "@/lib/shop-listing-publish";
import { printifyVariantShopFloorCents } from "@/lib/listing-cart-price";
import { listingCatalogUrlsForPersist } from "@/lib/product-media";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

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
  const p = listing.product;
  const minCents =
    p.fulfillmentType === FulfillmentType.printify
      ? printifyVariantShopFloorCents(
          p,
          getPrintifyVariantsForProduct(p)[0]?.priceCents ?? p.priceCents,
        )
      : p.minPriceCents > 0
        ? p.minPriceCents
        : p.priceCents;
  if (cents < minCents) return { ok: false };

  if (
    listing.product.fulfillmentType === FulfillmentType.printify &&
    getPrintifyVariantsForProduct(listing.product).length > 1
  ) {
    return { ok: false };
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
  if (listing.product.fulfillmentType !== FulfillmentType.printify) {
    return { ok: false, error: "This listing isn't a Printify product." };
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
  for (const v of variants) {
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
    const minAllowed = printifyVariantShopFloorCents(listing.product, v.priceCents);
    if (cents < minAllowed) {
      const platformHigher =
        listing.product.minPriceCents > 0 &&
        listing.product.minPriceCents > v.priceCents;
      return {
        ok: false,
        error: `"${v.title}" must be at least ${formatUsdFromCents(minAllowed)} (this size's synced Printify retail${platformHigher ? "; platform minimum is higher than this size's base" : ""}).`,
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
