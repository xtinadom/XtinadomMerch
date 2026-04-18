"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";
import {
  deleteLegacyShopProfileAvatarKeys,
  isR2UploadConfigured,
  putPublicR2Object,
  shopProfileAvatarObjectKey,
} from "@/lib/r2-upload";
import {
  compressShopListingArtworkWebp,
  compressShopProfileImageWebp,
} from "@/lib/shop-setup-image";
import { shopSocialLinksFromFormData } from "@/lib/shop-social-links";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { allocateUniqueShopSlug } from "@/lib/shop-slug";
import {
  encodeBaselinePickVariant,
  parseBaselinePick,
} from "@/lib/shop-baseline-catalog";
import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";
import {
  createBaselineAllVariantsStubProductForNewListing,
  createBaselineStubProductForNewListing,
} from "@/lib/shop-baseline-stub-product";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";

const WELCOME_MAX = 280;
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

export type ShopSetupActionResult = { ok: true } | { ok: false; error: string };

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

  await deleteLegacyShopProfileAvatarKeys(shop.id);
  const key = shopProfileAvatarObjectKey(shop.id);
  const url = await putPublicR2Object({
    key,
    body: webp,
    contentType: "image/webp",
  });

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
        "Confirm in the dialog that you have rights to your images and that they follow the item guidelines.",
    };
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

  const pickRaw = String(formData.get("productId") ?? "").trim();
  const dollars = String(formData.get("listingPriceDollars") ?? "").trim();
  if (!pickRaw) {
    return { ok: false, error: "Select an allowed item from the list." };
  }

  const baselinePick = parseBaselinePick(pickRaw);

  if (baselinePick?.mode === "allVariants") {
    const row = await prisma.adminCatalogItem.findUnique({
      where: { id: baselinePick.itemId },
    });
    if (!row) {
      return { ok: false, error: "That catalog item is not available." };
    }
    const variants = parseAdminCatalogVariantsJson(row.variants);
    if (variants.length === 0) {
      return { ok: false, error: "That catalog item has no variants to list." };
    }

    const variantPricesJson = String(formData.get("listingVariantPricesJson") ?? "").trim();
    let pricesPayload: Record<string, unknown>;
    try {
      pricesPayload = JSON.parse(variantPricesJson) as Record<string, unknown>;
      if (!pricesPayload || typeof pricesPayload !== "object" || Array.isArray(pricesPayload)) {
        return { ok: false, error: "Provide a list price for every variant." };
      }
    } catch {
      return { ok: false, error: "Provide a list price for every variant." };
    }

    const expectedKeys = new Set(
      variants.map((v) => encodeBaselinePickVariant(baselinePick.itemId, v.id)),
    );
    const keysFromClient = new Set(Object.keys(pricesPayload));
    if (expectedKeys.size !== keysFromClient.size) {
      return { ok: false, error: "Provide a list price for every variant." };
    }
    for (const k of expectedKeys) {
      if (!keysFromClient.has(k)) {
        return { ok: false, error: "Provide a list price for every variant." };
      }
    }

    const catalogVariantCents: Record<string, number> = {};
    let minSubmitted = Infinity;

    for (const v of variants) {
      const key = encodeBaselinePickVariant(baselinePick.itemId, v.id);
      const d = String(pricesPayload[key] ?? "").trim();
      const parsed = parseFloat(d.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false, error: "Enter a valid list price for each variant." };
      }
      const priceCents = Math.round(parsed * 100);
      const minCents = Math.max(0, v.minPriceCents);
      if (priceCents < minCents) {
        return {
          ok: false,
          error: `Price must be at least ${(minCents / 100).toFixed(2)} USD for ${v.label}.`,
        };
      }
      catalogVariantCents[v.id] = priceCents;
      minSubmitted = Math.min(minSubmitted, priceCents);
    }

    const stub = await createBaselineAllVariantsStubProductForNewListing(shop.id, baselinePick.itemId);
    if (!stub) {
      return { ok: false, error: "That catalog item is not available." };
    }
    const productId = stub.productId;
    const listingPriceCents = Number.isFinite(minSubmitted) ? minSubmitted : stub.minPriceCents;

    const file = formData.get("listingArtwork");
    if (!file || !(file instanceof Blob) || file.size === 0) {
      return { ok: false, error: "Upload a print-ready artwork file." };
    }
    if (file.size > 20 * 1024 * 1024) {
      return { ok: false, error: "Artwork file is too large (max 20 MB before processing)." };
    }

    const rawBuf = Buffer.from(await file.arrayBuffer());
    const webp = await compressShopListingArtworkWebp(rawBuf);
    if (!webp) {
      return {
        ok: false,
        error: "Could not process that artwork. Use a PNG or JPEG under 20 MB.",
      };
    }

    const key = `shops/${shop.id}/listing-request/${randomUUID()}.webp`;
    const url = await putPublicR2Object({
      key,
      body: webp,
      contentType: "image/webp",
    });

    await prisma.shopListing.create({
      data: {
        shopId: shop.id,
        productId,
        priceCents: listingPriceCents,
        listingPrintifyVariantPrices: catalogVariantCents as Prisma.InputJsonValue,
        requestItemName,
        requestImages: [url],
        requestStatus: ListingRequestStatus.submitted,
        active: false,
        baselineCatalogPickEncoded: pickRaw,
      },
    });

    await syncFreeListingFeeWaivers(shop.id);
    revalidatePath("/dashboard");
    revalidatePath(`/s/${shop.slug}`);
    revalidatePath("/admin");
    return { ok: true };
  }

  let productId: string;
  let minCents: number;

  if (baselinePick) {
    const stub = await createBaselineStubProductForNewListing(shop.id, baselinePick);
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

  const file = formData.get("listingArtwork");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: "Upload a print-ready artwork file." };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { ok: false, error: "Artwork file is too large (max 20 MB before processing)." };
  }

  const rawBuf = Buffer.from(await file.arrayBuffer());
  const webp = await compressShopListingArtworkWebp(rawBuf);
  if (!webp) {
    return {
      ok: false,
      error: "Could not process that artwork. Use a PNG or JPEG under 20 MB.",
    };
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
    requestImages: [url],
    requestStatus: ListingRequestStatus.submitted,
    active: false,
    ...(baselinePick ? { baselineCatalogPickEncoded: pickRaw } : {}),
  };

  if (baselinePick) {
    await prisma.shopListing.create({ data: listingCreateData });
  } else {
    await prisma.shopListing.upsert({
      where: { shopId_productId: { shopId: shop.id, productId } },
      create: listingCreateData,
      update: {
        priceCents,
        requestItemName,
        requestImages: [url],
        requestStatus: ListingRequestStatus.submitted,
        active: false,
      },
    });
  }

  await syncFreeListingFeeWaivers(shop.id);
  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  revalidatePath("/admin");
  return { ok: true };
}
