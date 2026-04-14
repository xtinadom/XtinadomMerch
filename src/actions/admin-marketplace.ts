"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";

const ADMIN_LISTING_REMOVAL_NOTES_MAX = 4000;
import { PLATFORM_SHOP_SLUG, listingFeeCentsForOrdinal } from "@/lib/marketplace-constants";
import { getListingOrdinal, syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import {
  deleteShopListingRequestImagesFromR2,
  shopListingRequestImageUrlStrings,
} from "@/lib/r2-upload";
import { activateProductWhenShopListingGoesLive } from "@/lib/shop-listing-publish";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

/** Step 1: record Printify product (and variant for printify catalog items). Moves submitted → printify_item_created. */
export async function adminMarkPrintifyListingReady(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const printifyProductId = String(formData.get("printifyProductId") ?? "").trim();
  const printifyVariantId = String(formData.get("printifyVariantId") ?? "").trim();
  if (!listingId || !printifyProductId) return;

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    include: { product: true },
  });
  if (!listing || listing.requestStatus !== ListingRequestStatus.submitted) return;

  if (listing.product.fulfillmentType === FulfillmentType.printify && !printifyVariantId) {
    return;
  }

  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      listingPrintifyProductId: printifyProductId,
      listingPrintifyVariantId: printifyVariantId || null,
      requestStatus: ListingRequestStatus.printify_item_created,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/shops");
}

/**
 * Step 2: approve listing (requires Printify IDs). Applies free-slot waivers, charges listing fee policy,
 * and either goes live or asks the shop to pay the publication fee.
 */
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
  if (!listing || !product || listing.productId !== product.id) return;

  if (listing.requestStatus !== ListingRequestStatus.printify_item_created) return;
  if (!listing.listingPrintifyProductId?.trim()) return;
  if (product.fulfillmentType === FulfillmentType.printify && !listing.listingPrintifyVariantId?.trim()) {
    return;
  }

  const isPlatform = listing.shop.slug === PLATFORM_SHOP_SLUG;
  const ordinal = await getListingOrdinal(listingId, listing.shopId);
  if (ordinal === null) return;

  const feeCents = isPlatform ? 0 : listingFeeCentsForOrdinal(ordinal, listing.shop.slug);
  const alreadyPaid = listing.listingFeePaidAt != null;

  const requestImageUrls = shopListingRequestImageUrlStrings(listing.requestImages);
  await deleteShopListingRequestImagesFromR2(listing.shopId, requestImageUrls);

  if (isPlatform) {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: {
        requestStatus: ListingRequestStatus.approved,
        active: true,
        priceCents: product.priceCents,
        requestImages: [],
      },
    });
    await activateProductWhenShopListingGoesLive(productId, listing.shop.slug);
    await syncFreeListingFeeWaivers(listing.shopId);
    revalidatePath("/admin");
    revalidatePath("/shops");
    revalidatePath("/dashboard");
    return;
  }

  if (feeCents === 0) {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: {
        requestStatus: ListingRequestStatus.approved,
        active: true,
        priceCents: product.priceCents,
        listingFeePaidAt: listing.listingFeePaidAt ?? new Date(),
        requestImages: [],
      },
    });
    await activateProductWhenShopListingGoesLive(productId, listing.shop.slug);
    await syncFreeListingFeeWaivers(listing.shopId);
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: listing.shopId,
        kind: "listing_approved",
        body: `Your listing for “${product.name}” is approved and live in your shop.`,
      },
    });
  } else if (alreadyPaid) {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: {
        requestStatus: ListingRequestStatus.approved,
        active: true,
        priceCents: product.priceCents,
        requestImages: [],
      },
    });
    await activateProductWhenShopListingGoesLive(productId, listing.shop.slug);
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: listing.shopId,
        kind: "listing_approved",
        body: `Your listing for “${product.name}” is approved and live in your shop.`,
      },
    });
  } else {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: {
        requestStatus: ListingRequestStatus.approved,
        active: false,
        priceCents: product.priceCents,
        requestImages: [],
      },
    });
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: listing.shopId,
        kind: "listing_approved_pay_fee",
        body: `Your listing for “${product.name}” was approved. Pay the publication fee on the Listings tab to publish it in your shop.`,
      },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
}

/** Sets `active: false` so the listing no longer appears on the creator’s storefront (approved listings only). */
export async function adminFreezeShopListing(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: {
      requestStatus: true,
      active: true,
      shopId: true,
      product: { select: { name: true } },
    },
  });
  if (!listing || listing.requestStatus !== ListingRequestStatus.approved || !listing.active) return;

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { active: false, adminRemovedFromShopAt: new Date() },
  });
  await prisma.shopOwnerNotice.create({
    data: {
      shopId: listing.shopId,
      kind: "listing_admin_frozen",
      body: `The platform froze “${listing.product.name}” — it is hidden from your public shop. Check the Listings tab or contact support if you have questions.`,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
}

/**
 * Removes a row from the admin Listing requests queue. Records removal time for the Removed items tab.
 * In-flight requests (submitted / printify_item_created) are rejected like Reject.
 * If the listing is live on the creator’s shop (approved and active), it is frozen off the storefront.
 */
export async function adminRemoveListingFromRequestsQueue(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: {
      removedFromListingRequestsAt: true,
      requestStatus: true,
      active: true,
      shopId: true,
      requestImages: true,
      product: { select: { name: true } },
    },
  });
  if (!listing || listing.removedFromListingRequestsAt) return;

  const requestImageUrls = shopListingRequestImageUrlStrings(listing.requestImages);
  await deleteShopListingRequestImagesFromR2(listing.shopId, requestImageUrls);

  const now = new Date();
  const base = {
    removedFromListingRequestsAt: now,
  } as const;
  const productLabel = listing.product.name;

  if (listing.requestStatus === ListingRequestStatus.approved) {
    const wasLive = listing.active;
    const data: {
      removedFromListingRequestsAt: Date;
      active?: boolean;
      adminRemovedFromShopAt?: Date;
      requestImages: [];
    } = { ...base, requestImages: [] };
    if (wasLive) {
      data.active = false;
      data.adminRemovedFromShopAt = now;
    }
    await prisma.shopListing.update({ where: { id: listingId }, data });
    if (wasLive) {
      await prisma.shopOwnerNotice.create({
        data: {
          shopId: listing.shopId,
          kind: "listing_admin_frozen",
          body: `The platform removed this listing from admin review and took “${productLabel}” off your public shop. Contact support if you need help.`,
        },
      });
    } else {
      await prisma.shopOwnerNotice.create({
        data: {
          shopId: listing.shopId,
          kind: "listing_removed_from_queue",
          body: `The platform removed “${productLabel}” from the admin listing queue. Open your dashboard for details or contact support.`,
        },
      });
    }
  } else if (
    listing.requestStatus === ListingRequestStatus.submitted ||
    listing.requestStatus === ListingRequestStatus.printify_item_created
  ) {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: {
        ...base,
        requestStatus: ListingRequestStatus.rejected,
        active: false,
        listingPrintifyProductId: null,
        listingPrintifyVariantId: null,
        requestImages: [],
      },
    });
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: listing.shopId,
        kind: "listing_rejected",
        body: `The platform removed your listing request for “${productLabel}” from review and marked it rejected. Check the Listings tab or contact support.`,
      },
    });
  } else {
    return;
  }

  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
}

export async function adminUpdateListingRemovalNotes(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const notesRaw = String(formData.get("adminListingRemovalNotes") ?? "");
  if (!listingId) return;

  const notes =
    notesRaw.length > ADMIN_LISTING_REMOVAL_NOTES_MAX
      ? notesRaw.slice(0, ADMIN_LISTING_REMOVAL_NOTES_MAX)
      : notesRaw;

  const row = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: { removedFromListingRequestsAt: true },
  });
  if (!row?.removedFromListingRequestsAt) return;

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { adminListingRemovalNotes: notes.trim() ? notes : null },
  });
  revalidatePath("/admin");
}

/**
 * Clears removal audit fields so the listing drops off **Removed items** and **Shop watch** (same action from either tab).
 * Clears admin freeze, creator self-remove, listing-requests queue timestamp, and internal removal notes.
 * Does not delete the listing row or change request status / active flags by itself.
 */
export async function adminDeleteListingRemovalRecord(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: {
      adminRemovedFromShopAt: true,
      creatorRemovedFromShopAt: true,
      removedFromListingRequestsAt: true,
    },
  });
  if (
    !listing ||
    (listing.adminRemovedFromShopAt == null &&
      listing.creatorRemovedFromShopAt == null &&
      listing.removedFromListingRequestsAt == null)
  ) {
    return;
  }

  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      adminRemovedFromShopAt: null,
      creatorRemovedFromShopAt: null,
      removedFromListingRequestsAt: null,
      adminListingRemovalNotes: null,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
}

export async function adminRejectListingRequest(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;
  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: {
      requestStatus: true,
      shopId: true,
      requestImages: true,
      product: { select: { name: true } },
    },
  });
  if (
    !listing ||
    (listing.requestStatus !== ListingRequestStatus.submitted &&
      listing.requestStatus !== ListingRequestStatus.printify_item_created)
  ) {
    return;
  }
  const requestImageUrls = shopListingRequestImageUrlStrings(listing.requestImages);
  await deleteShopListingRequestImagesFromR2(listing.shopId, requestImageUrls);
  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      requestStatus: ListingRequestStatus.rejected,
      active: false,
      listingPrintifyProductId: null,
      listingPrintifyVariantId: null,
      requestImages: [],
    },
  });
  await prisma.shopOwnerNotice.create({
    data: {
      shopId: listing.shopId,
      kind: "listing_rejected",
      body: `The platform rejected your listing request for “${listing.product.name}”. Open the Listings tab for status or contact support.`,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
}
