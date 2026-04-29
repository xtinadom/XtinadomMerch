"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";
import {
  deleteR2ObjectsByKeys,
  deleteLegacyShopProfileAvatarKeys,
  isR2UploadConfigured,
  publicUrlToR2ObjectKey,
  putPublicR2Object,
  shopProfileAvatarObjectKey,
} from "@/lib/r2-upload";
import {
  compressShopListingArtworkWebp,
  compressShopProfileImageWebp,
} from "@/lib/shop-setup-image";
import {
  shopSocialLinksFormValidationError,
  shopSocialLinksFromFormData,
} from "@/lib/shop-social-links";
import {
  PLATFORM_SHOP_SLUG,
  SHOP_LISTING_MAX_PRICE_CENTS,
  listingFeeCentsForOrdinal,
  shopListingMaxPriceUsdLabel,
} from "@/lib/marketplace-constants";
import { shopStripeConnectReadyForListingCharges } from "@/lib/shop-stripe-connect-gate";
import { ensureListingFeeStripeConnectNotice } from "@/lib/listing-fee-connect-notice";
import { allocateUniqueShopSlug } from "@/lib/shop-slug";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import {
  createBaselineStubProductForNewListing,
  type BaselineStubPick,
} from "@/lib/shop-baseline-stub-product";
import { downgradeSubmittedToDraftIfListingFeeUnpaid } from "@/lib/listing-fee";
import { widthHeightPxFromImageBuffer } from "@/lib/artwork-image-dimensions";
import { exportedImageMeetsPrintDimensions } from "@/lib/listing-artwork-print-area";
import { syncProductTagsForNewBaselineListing } from "@/lib/baseline-listing-product-tags-sync";
import { normalizeSearchKeywords, SEARCH_KEYWORDS_MAX } from "@/lib/search-keywords-normalize";

const WELCOME_MAX = 280;
const STOREFRONT_ITEM_BLURB_MAX = 280;
const REQUEST_ITEM_NAME_MAX = 120;

function parseRequestItemNameFromForm(
  formData: FormData,
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = String(formData.get("requestItemName") ?? "").trim();
  if (!raw) {
    return { ok: false, error: "Enter a name for this item." };
  }
  if (raw.length > REQUEST_ITEM_NAME_MAX) {
    return {
      ok: false,
      error: `Item name must be ${REQUEST_ITEM_NAME_MAX} characters or fewer.`,
    };
  }
  return { ok: true, value: raw };
}

export type ShopSetupActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

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

export async function updateShopProfileSetup(
  formData: FormData,
): Promise<ShopSetupActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const shopUsernameRaw = String(formData.get("shopUsername") ?? "").trim();
  if (!shopUsernameRaw || shopUsernameRaw.length > 80) {
    return { ok: false, error: "Shop username is required (max 80 characters)." };
  }
  const slugResult = await allocateUniqueShopSlug(shopUsernameRaw, shop.id);
  if ("error" in slugResult) {
    return { ok: false, error: slugResult.error };
  }
  const nextSlug = slugResult.slug;
  const oldSlug = shop.slug;

  const displayName = String(formData.get("displayName") ?? "").trim();
  const welcomeRaw = String(formData.get("welcomeMessage") ?? "").trim();
  if (!displayName || displayName.length > 120) {
    return { ok: false, error: "Shop display name is required (max 120 characters)." };
  }
  if (welcomeRaw.length > WELCOME_MAX) {
    return { ok: false, error: `Welcome message must be ${WELCOME_MAX} characters or fewer.` };
  }

  const socialFormErr = shopSocialLinksFormValidationError(formData);
  if (socialFormErr) {
    return { ok: false, error: socialFormErr };
  }

  const socialLinks = shopSocialLinksFromFormData(formData);
  const socialJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    Object.keys(socialLinks).length > 0
      ? (socialLinks as Prisma.InputJsonValue)
      : Prisma.JsonNull;

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      slug: nextSlug,
      displayName,
      welcomeMessage: welcomeRaw || null,
      socialLinks: socialJson,
    },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${oldSlug}`);
  revalidatePath(`/s/${nextSlug}`);
  revalidatePath("/shops");
  return { ok: true };
}

/** Public directory opt-in: `/shops` and home “top shops” only when true. */
export async function updateShopListedOnShopsBrowseForm(
  formData: FormData,
): Promise<ShopSetupActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  const raw = String(formData.get("listedOnShopsBrowse") ?? "").trim().toLowerCase();
  const listed = raw === "1" || raw === "true" || raw === "yes";
  const unlisted = raw === "0" || raw === "false" || raw === "no";
  if (!listed && !unlisted) {
    return { ok: false, error: "Choose whether your store appears on the shops list." };
  }
  await prisma.shop.update({
    where: { id: shop.id },
    data: { listedOnShopsBrowse: listed },
  });
  revalidatePath("/dashboard");
  revalidatePath("/shops");
  revalidatePath("/");
  return { ok: true };
}

export async function acknowledgeShopItemGuidelines(): Promise<void> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return;
  }
  await prisma.shop.update({
    where: { id: shop.id },
    data: { itemGuidelinesAcknowledgedAt: new Date() },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
}

export async function uploadShopProfileImageSetup(
  formData: FormData,
): Promise<ShopSetupActionResult> {
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

  const file = formData.get("profileImage");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: "Choose an image file to upload." };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { ok: false, error: "Image is too large before processing (max 15 MB)." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const webp = await compressShopProfileImageWebp(buf);
  if (!webp) {
    return {
      ok: false,
      error: "Could not compress that image to under 100 KiB. Try a simpler photo.",
    };
  }

  const previousUrl = shop.profileImageUrl;
  const previousKey = previousUrl ? publicUrlToR2ObjectKey(previousUrl) : null;

  // Best-effort: remove any old rolling keys before writing the next one.
  // (We run this *before* upload so we never delete the new key by mistake.)
  await deleteLegacyShopProfileAvatarKeys(shop.id);
  // Best-effort: also remove the old canonical key used by earlier versions.
  await deleteR2ObjectsByKeys([shopProfileAvatarObjectKey(shop.id)]);

  const key = `shops/${shop.id}/avatar-${randomUUID()}.webp`;
  const url = await putPublicR2Object({
    key,
    body: webp,
    contentType: "image/webp",
  });
  // Best-effort: delete the previous avatar object (covers older `avatar.webp?v=...` URLs too).
  if (previousKey && previousKey.startsWith(`shops/${shop.id}/`) && previousKey !== key) {
    await deleteR2ObjectsByKeys([previousKey]);
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: { profileImageUrl: url },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  revalidatePath("/shops");
  return { ok: true };
}

export async function submitFirstListingSetup(
  formData: FormData,
): Promise<ShopSetupActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  if (String(formData.get("guidelinesAttestation") ?? "").trim() !== "1") {
    return {
      ok: false,
      error:
        "Confirm in the dialog that you have rights to your images and that they follow the shop regulations.",
    };
  }

  // Publication fees are based on *requests submitted*, not approvals.
  // Drafts do not count toward the free-slot ordinal.
  const existingSubmittedRequestCount = await prisma.shopListing.count({
    where: { shopId: shop.id, requestStatus: { not: ListingRequestStatus.draft } },
  });
  const nextListingOrdinal = existingSubmittedRequestCount + 1;
  const publicationFeeCentsForRequest = listingFeeCentsForOrdinal(
    nextListingOrdinal,
    shop.slug,
    shop.listingFeeBonusFreeSlots ?? 0,
  );
  if (publicationFeeCentsForRequest > 0) {
    if (String(formData.get("feeChargeAttestation") ?? "").trim() !== "1") {
      return {
        ok: false,
        error:
          "Confirm the publication fee agreement in the dialog before submitting your listing request.",
      };
    }
    if (!shopStripeConnectReadyForListingCharges(shop)) {
      await ensureListingFeeStripeConnectNotice(shop.id);
      return {
        ok: false,
        error:
          "Finish Stripe Connect on the Onboarding tab (charges and payouts enabled) before creating a listing that has a publication fee.",
      };
    }
  }

  if (!isR2UploadConfigured()) {
    return {
      ok: false,
      error: "Image uploads are not configured (R2 env vars missing on the server).",
    };
  }

  const itemNameParsed = parseRequestItemNameFromForm(formData);
  if (!itemNameParsed.ok) {
    return { ok: false, error: itemNameParsed.error };
  }
  const requestItemName = itemNameParsed.value;

  const blurbRaw = String(formData.get("storefrontItemBlurb") ?? "").trim();
  if (blurbRaw.length > STOREFRONT_ITEM_BLURB_MAX) {
    return {
      ok: false,
      error: `Storefront pitch must be ${STOREFRONT_ITEM_BLURB_MAX} characters or fewer.`,
    };
  }
  const keywordsRaw = String(formData.get("listingSearchKeywords") ?? "");
  if (keywordsRaw.trim().length > SEARCH_KEYWORDS_MAX) {
    return { ok: false, error: `Keywords must be ${SEARCH_KEYWORDS_MAX} characters or fewer.` };
  }
  const storefrontItemBlurb = blurbRaw.length > 0 ? blurbRaw : null;
  const listingSearchKeywords = normalizeSearchKeywords(keywordsRaw);

  const pickRaw = String(formData.get("productId") ?? "").trim();
  const dollars = String(formData.get("listingPriceDollars") ?? "").trim();
  if (!pickRaw) {
    return { ok: false, error: "Select an allowed item from the list." };
  }

  const baselinePick = parseBaselinePick(pickRaw);

  if (baselinePick?.mode === "allVariants") {
    return {
      ok: false,
      error:
        "The listing catalog was updated. Refresh this page, then select your item again and resubmit.",
    };
  }

  let productId: string;
  let minCents: number;

  if (baselinePick) {
    const stub = await createBaselineStubProductForNewListing(
      shop.id,
      baselinePick as BaselineStubPick,
    );
    if (!stub) {
      return { ok: false, error: "That catalog item is not available." };
    }
    productId = stub.productId;
    minCents = stub.minPriceCents;
  } else {
    const product = await prisma.product.findFirst({
      where: {
        id: pickRaw,
        active: true,
        fulfillmentType: FulfillmentType.printify,
      },
      select: {
        id: true,
        minPriceCents: true,
        priceCents: true,
      },
    });
    if (!product) {
      return { ok: false, error: "That catalog item is not available." };
    }
    productId = product.id;
    minCents = product.minPriceCents > 0 ? product.minPriceCents : product.priceCents;
  }

  const maxLabel = shopListingMaxPriceUsdLabel();
  if (minCents > SHOP_LISTING_MAX_PRICE_CENTS) {
    return {
      ok: false,
      error: `This item's minimum price (${(minCents / 100).toFixed(2)} USD) is above the ${maxLabel} listing cap. Pick another product or contact support.`,
    };
  }

  const parsed = parseFloat(dollars.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, error: "Enter a valid list price." };
  }
  const priceCents = Math.round(parsed * 100);
  if (priceCents < minCents) {
    return {
      ok: false,
      error: `Price must be at least ${(minCents / 100).toFixed(2)} USD for this item.`,
    };
  }
  if (priceCents > SHOP_LISTING_MAX_PRICE_CENTS) {
    return {
      ok: false,
      error: `List price cannot exceed ${maxLabel} per listing.`,
    };
  }

  const file = formData.get("listingArtwork");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: "Upload a print-ready artwork file." };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { ok: false, error: "Artwork file is too large (max 20 MB before processing)." };
  }

  const rawBuf = Buffer.from(await file.arrayBuffer());

  let preserveListingArtworkPixels = false;
  let printAreaW: number | null = null;
  let printAreaH: number | null = null;

  if (baselinePick) {
    const adminItem = await prisma.adminCatalogItem.findUnique({
      where: { id: baselinePick.itemId },
      select: {
        itemImageRequirementLabel: true,
        itemPrintAreaWidthPx: true,
        itemPrintAreaHeightPx: true,
      },
    });
    const pw = adminItem?.itemPrintAreaWidthPx ?? null;
    const ph = adminItem?.itemPrintAreaHeightPx ?? null;
    const hasPrintArea = pw != null && ph != null && pw > 0 && ph > 0;

    if (hasPrintArea) {
      printAreaW = pw;
      printAreaH = ph;
      const dims = await widthHeightPxFromImageBuffer(rawBuf);
      if (!dims) {
        return {
          ok: false,
          error: "Could not read image dimensions. Use a valid PNG or JPEG file.",
        };
      }
      if (!exportedImageMeetsPrintDimensions(dims.w, dims.h, pw, ph)) {
        const note = adminItem?.itemImageRequirementLabel?.trim();
        return {
          ok: false,
          error: note
            ? `Artwork must be exactly ${pw}×${ph}px for this item (${note}). This file is ${dims.w}×${dims.h}px.`
            : `Artwork must be exactly ${pw}×${ph}px for this item. This file is ${dims.w}×${dims.h}px.`,
        };
      }
      preserveListingArtworkPixels = true;
    }
  }

  const webp = await compressShopListingArtworkWebp(rawBuf, {
    ...(preserveListingArtworkPixels ? { preservePixelDimensions: true } : {}),
  });
  if (!webp) {
    return {
      ok: false,
      error: "Could not process that artwork. Use a PNG or JPEG under 20 MB.",
    };
  }

  if (printAreaW != null && printAreaH != null) {
    const outDims = await widthHeightPxFromImageBuffer(webp);
    if (!outDims || !exportedImageMeetsPrintDimensions(outDims.w, outDims.h, printAreaW, printAreaH)) {
      return {
        ok: false,
        error:
          "Artwork dimensions were lost during processing (file too large after WebP encode). Export a slightly smaller JPEG or PNG and try again.",
      };
    }
  }

  const key = `shops/${shop.id}/listing-request/${randomUUID()}.webp`;
  const url = await putPublicR2Object({
    key,
    body: webp,
    contentType: "image/webp",
  });

  const existing = await prisma.shopListing.findUnique({
    where: { shopId_productId: { shopId: shop.id, productId } },
  });
  if (existing) {
    if (existing.active || existing.requestStatus === ListingRequestStatus.approved) {
      return { ok: false, error: "That item is already live on your shop." };
    }
    if (
      existing.requestStatus === ListingRequestStatus.submitted ||
      existing.requestStatus === ListingRequestStatus.images_ok ||
      existing.requestStatus === ListingRequestStatus.printify_item_created
    ) {
      return {
        ok: false,
        error: "That item is already waiting for admin review. Pick another product or wait for a decision.",
      };
    }
  }

  const listingCreateData = {
    shopId: shop.id,
    productId,
    priceCents,
    requestItemName,
    storefrontItemBlurb,
    listingSearchKeywords,
    requestImages: [url],
    requestStatus: ListingRequestStatus.submitted,
    active: false,
    ...(baselinePick ? { baselineCatalogPickEncoded: pickRaw } : {}),
  };

  const saved = baselinePick
    ? await prisma.shopListing.create({ data: listingCreateData })
    : await prisma.shopListing.upsert({
        where: { shopId_productId: { shopId: shop.id, productId } },
        create: listingCreateData,
        update: {
          priceCents,
          requestItemName,
          storefrontItemBlurb,
          listingSearchKeywords,
          requestImages: [url],
          requestStatus: ListingRequestStatus.submitted,
          active: false,
        },
      });

  if (baselinePick) {
    await syncProductTagsForNewBaselineListing({
      adminCatalogItemId: baselinePick.itemId,
      productId,
      shopSlug: shop.slug,
    });
  }

  const gate = await downgradeSubmittedToDraftIfListingFeeUnpaid(
    shop.id,
    shop.slug,
    saved.id,
  );
  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  revalidateAdminViews();
  if (gate.downgraded && gate.message) {
    return { ok: true, message: gate.message };
  }
  return { ok: true };
}
