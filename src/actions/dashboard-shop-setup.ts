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
import { minListPriceCentsForProductFromAdminCatalog } from "@/lib/shop-setup-catalog-options";

const WELCOME_MAX = 280;

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
      displayName,
      welcomeMessage: welcomeRaw || null,
      socialLinks: socialJson,
    },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  revalidatePath("/shops");
  return { ok: true };
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
  if (!isR2UploadConfigured()) {
    return {
      ok: false,
      error: "Image uploads are not configured (R2 env vars missing on the server).",
    };
  }

  const productId = String(formData.get("productId") ?? "").trim();
  const dollars = String(formData.get("listingPriceDollars") ?? "").trim();
  if (!productId) {
    return { ok: false, error: "Select a product from the catalog." };
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      active: true,
      fulfillmentType: FulfillmentType.printify,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      minPriceCents: true,
      priceCents: true,
    },
  });
  if (!product) {
    return { ok: false, error: "That catalog item is not available." };
  }

  const parsed = parseFloat(dollars.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, error: "Enter a valid list price." };
  }
  const priceCents = Math.round(parsed * 100);
  const [adminRows, allPrintifyCatalog] = await Promise.all([
    prisma.adminCatalogItem.findMany({
      select: {
        name: true,
        variants: true,
        itemPlatformProductId: true,
        itemExampleListingUrl: true,
        itemMinPriceCents: true,
      },
    }),
    prisma.product.findMany({
      where: { active: true, fulfillmentType: FulfillmentType.printify },
      select: {
        id: true,
        slug: true,
        name: true,
        minPriceCents: true,
        priceCents: true,
      },
    }),
  ]);
  const minCents = minListPriceCentsForProductFromAdminCatalog(
    product.id,
    adminRows,
    product,
    allPrintifyCatalog,
  );
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
    if (existing.requestStatus === ListingRequestStatus.submitted) {
      return {
        ok: false,
        error: "That item is already waiting for admin review. Pick another product or wait for a decision.",
      };
    }
  }

  await prisma.shopListing.upsert({
    where: { shopId_productId: { shopId: shop.id, productId } },
    create: {
      shopId: shop.id,
      productId,
      priceCents,
      requestImages: [url],
      requestStatus: ListingRequestStatus.submitted,
      active: false,
    },
    update: {
      priceCents,
      requestImages: [url],
      requestStatus: ListingRequestStatus.submitted,
      active: false,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  revalidatePath("/admin");
  return { ok: true };
}
