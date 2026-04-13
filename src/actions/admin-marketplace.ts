"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function adminUpdateShopSpotlight(formData: FormData) {
  await requireAdmin();
  const shopId = String(formData.get("shopId") ?? "").trim();
  const listingIdRaw = String(formData.get("homeFeaturedListingId") ?? "").trim();
  const priorityRaw = String(formData.get("editorialPriority") ?? "").trim();
  const pinnedRaw = String(formData.get("editorialPinnedUntil") ?? "").trim();
  if (!shopId) return;

  const homeFeaturedListingId =
    listingIdRaw && listingIdRaw !== "__none__" ? listingIdRaw : null;
  if (homeFeaturedListingId) {
    const listing = await prisma.shopListing.findFirst({
      where: { id: homeFeaturedListingId, shopId },
    });
    if (!listing) return;
  }

  const editorialPriority =
    priorityRaw === "" ? null : Math.max(0, Math.min(9999, parseInt(priorityRaw, 10) || 0));
  let editorialPinnedUntil: Date | null = null;
  if (pinnedRaw.trim()) {
    const d = new Date(pinnedRaw);
    if (!Number.isNaN(d.getTime())) editorialPinnedUntil = d;
  }

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      homeFeaturedListingId,
      editorialPriority,
      editorialPinnedUntil,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/shops");
}

export async function adminSetProductMinPrice(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "").trim();
  const cents = parseInt(String(formData.get("minPriceCents") ?? ""), 10);
  if (!productId || !Number.isFinite(cents) || cents < 0) return;
  await prisma.product.update({
    where: { id: productId },
    data: { minPriceCents: cents },
  });
  revalidatePath("/admin");
  revalidatePath("/shops");
}

export async function adminApproveListingRequest(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  if (!listingId || !productId) return;

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    include: { shop: true },
  });
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!listing || !product) return;

  if (
    listing.shop.slug !== PLATFORM_SHOP_SLUG &&
    !listing.listingFeePaidAt
  ) {
    return;
  }

  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      productId,
      requestStatus: ListingRequestStatus.approved,
      active: true,
      priceCents: product.priceCents,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/shops");
}

export async function adminRejectListingRequest(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;
  await prisma.shopListing.update({
    where: { id: listingId },
    data: { requestStatus: ListingRequestStatus.rejected, active: false },
  });
  revalidatePath("/admin");
  revalidatePath("/shops");
}

export async function adminAssignShopListing(formData: FormData) {
  await requireAdmin();
  const shopId = String(formData.get("shopId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  const waiveFee =
    formData.get("waiveListingFee") === "on" ||
    formData.get("waiveListingFee") === "true";
  if (!shopId || !productId) return;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  await prisma.shopListing.upsert({
    where: { shopId_productId: { shopId, productId } },
    create: {
      shopId,
      productId,
      priceCents: product.priceCents,
      active: false,
      requestStatus: ListingRequestStatus.draft,
      listingFeePaidAt: waiveFee ? new Date() : null,
    },
    update: {
      requestStatus: ListingRequestStatus.draft,
      active: false,
      ...(waiveFee ? { listingFeePaidAt: new Date() } : {}),
    },
  });
  await syncFreeListingFeeWaivers(shopId);
  revalidatePath("/admin");
  revalidatePath("/shops");
}
