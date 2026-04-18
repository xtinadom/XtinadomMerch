"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAdminSessionReadonly } from "@/lib/session";
import { ListingRequestStatus } from "@/generated/prisma/enums";

const ADMIN_LISTING_REMOVAL_NOTES_MAX = 4000;
import { PLATFORM_SHOP_SLUG, listingFeeCentsForOrdinal } from "@/lib/marketplace-constants";
import { getListingOrdinal, syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import {
  deleteShopListingAdminSecondaryObject,
  deleteShopListingRequestImagesFromR2,
  deleteShopListingSupplementObject,
  isR2UploadConfigured,
  listingAdminSecondaryImageUrlToObjectKey,
  putPublicR2Object,
  shopListingAdminSecondaryImageObjectKey,
  shopListingRequestImageUrlStrings,
} from "@/lib/r2-upload";
import { compressShopListingSupplementPhotoWebp } from "@/lib/shop-setup-image";
import { fetchPublicHttpsImage, parseSafePublicHttpsImageUrl } from "@/lib/fetch-public-https-image";
import { productImageUrlsUnionHero } from "@/lib/product-media";
import { activateProductWhenShopListingGoesLive } from "@/lib/shop-listing-publish";
import { syncListingProductWithPrintifyCatalog } from "@/lib/shop-listing-printify-product-sync";
import { fetchPrintifyProductDetail, isPrintifyConfigured } from "@/lib/printify";
import { defaultPrintifyVariantIdForCatalogProduct } from "@/lib/printify-catalog";
import {
  listingRejectionNoticeDetail,
  parseListingRejectReason,
} from "@/lib/listing-request-reject-reasons";
import { emailLinkOrigin, publicAppBaseUrl } from "@/lib/public-app-url";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

async function loadListingForAdminSecondaryImage(listingId: string) {
  return prisma.shopListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      shopId: true,
      requestStatus: true,
      adminListingSecondaryImageUrl: true,
      shop: { select: { slug: true } },
    },
  });
}

function listingAllowsAdminSecondaryImage(status: ListingRequestStatus): boolean {
  return (
    status === ListingRequestStatus.printify_item_created || status === ListingRequestStatus.approved
  );
}

export type AdminSecondaryImageFormState = {
  ok: boolean;
  error: string | null;
};

const initialSecondaryImageFormState: AdminSecondaryImageFormState = {
  ok: false,
  error: null,
};

/**
 * Optional admin second storefront image (~100 KiB WebP on R2) or import from HTTPS URL.
 * For use with `useActionState` on the listing-requests admin form.
 */
export async function adminUpsertShopListingSecondaryImageForm(
  _prev: AdminSecondaryImageFormState,
  formData: FormData,
): Promise<AdminSecondaryImageFormState> {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) {
    return { ok: false, error: "Missing listing." };
  }

  const listing = await loadListingForAdminSecondaryImage(listingId);
  if (!listing || !listingAllowsAdminSecondaryImage(listing.requestStatus)) {
    return { ok: false, error: "This listing cannot be updated from this screen." };
  }

  if (!isR2UploadConfigured()) {
    return {
      ok: false,
      error: "Image uploads are not configured (R2 env vars missing on the server).",
    };
  }

  const fileRaw = formData.get("adminListingSecondaryImageFile");
  const urlRaw = String(formData.get("adminListingSecondaryImageUrl") ?? "").trim();

  let buf: Buffer | null = null;
  if (fileRaw instanceof Blob && fileRaw.size > 0) {
    if (fileRaw.size > 20 * 1024 * 1024) {
      return { ok: false, error: "File is too large before processing (max 20 MB)." };
    }
    buf = Buffer.from(await fileRaw.arrayBuffer());
  } else if (urlRaw) {
    const u = parseSafePublicHttpsImageUrl(urlRaw);
    if (!u) {
      return {
        ok: false,
        error: "Use a public https:// image URL (private networks and non-HTTPS links are blocked).",
      };
    }
    buf = await fetchPublicHttpsImage(u);
  } else {
    return { ok: false, error: "Choose an image file or paste an HTTPS image URL." };
  }

  if (!buf) {
    return {
      ok: false,
      error: "Could not load that image from the URL. Check the link or try a file upload instead.",
    };
  }
  const webp = await compressShopListingSupplementPhotoWebp(buf);
  if (!webp) {
    return {
      ok: false,
      error: "Could not compress to under 100 KiB. Try a smaller or simpler image.",
    };
  }

  try {
    const key = shopListingAdminSecondaryImageObjectKey(listing.shopId, listingId);
    const publicUrl = await putPublicR2Object({
      key,
      body: webp,
      contentType: "image/webp",
    });
    if (!listingAdminSecondaryImageUrlToObjectKey(publicUrl, listing.shopId, listingId)) {
      return { ok: false, error: "Upload succeeded but URL validation failed. Try again or contact support." };
    }

    await prisma.shopListing.update({
      where: { id: listingId },
      data: { adminListingSecondaryImageUrl: publicUrl },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Upload failed: ${msg}` };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/s/${listing.shop.slug}`);

  return { ok: true, error: null };
}

/** @deprecated Use {@link adminUpsertShopListingSecondaryImageForm} with useActionState */
export async function adminUpsertShopListingSecondaryImage(formData: FormData): Promise<void> {
  await adminUpsertShopListingSecondaryImageForm(initialSecondaryImageFormState, formData);
}

export async function adminClearShopListingSecondaryImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await loadListingForAdminSecondaryImage(listingId);
  if (!listing || !listingAllowsAdminSecondaryImage(listing.requestStatus)) return;

  await deleteShopListingAdminSecondaryObject(listing.shopId, listingId);
  await prisma.shopListing.update({
    where: { id: listingId },
    data: { adminListingSecondaryImageUrl: null },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/s/${listing.shop.slug}`);
}

/** After reference images are accepted: submitted → images_ok. */
export async function adminMarkListingImagesOk(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: { requestStatus: true },
  });
  if (!listing || listing.requestStatus !== ListingRequestStatus.submitted) return;

  const row = await prisma.shopListing.update({
    where: { id: listingId },
    data: { requestStatus: ListingRequestStatus.images_ok },
    select: { shop: { select: { slug: true } } },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/s/${row.shop.slug}`);
}

/** Same as {@link adminMarkListingImagesOk} for every legacy multi-size stub in one POST (all must be `submitted`). */
export async function adminMarkLegacyVariantListingGroupImagesOk(formData: FormData): Promise<void> {
  await requireAdmin();
  const listingIds = parseLegacyGroupListingIdsJson(formData.get("legacyGroupListingIdsJson"));
  if (!listingIds) return;

  const rows = await prisma.shopListing.findMany({
    where: { id: { in: listingIds } },
    select: { id: true, shopId: true, requestStatus: true },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length !== listingIds.length) return;

  const shopId = rows[0]!.shopId;
  if (rows.some((r) => r.shopId !== shopId)) return;
  if (rows.some((r) => r.requestStatus !== ListingRequestStatus.submitted)) return;

  await prisma.$transaction(
    rows.map((r) =>
      prisma.shopListing.update({
        where: { id: r.id },
        data: { requestStatus: ListingRequestStatus.images_ok },
      }),
    ),
  );

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { slug: true } });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  if (shop?.slug) revalidatePath(`/s/${shop.slug}`);
}

/**
 * Record or update Printify product on the listing. Default Printify variant is resolved from the API when absent.
 * From `images_ok` → `printify_item_created`. From `printify_item_created` or `approved`, updates IDs and re-syncs
 * without changing status (resave / fix mapping before or after approval).
 */
export async function adminMarkPrintifyListingReady(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const printifyProductId = String(formData.get("printifyProductId") ?? "").trim();
  let printifyVariantId = String(formData.get("printifyVariantId") ?? "").trim();
  if (!listingId || !printifyProductId) return;

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    include: { product: true, shop: { select: { slug: true } } },
  });
  const st = listing?.requestStatus;
  const allowed =
    st === ListingRequestStatus.images_ok ||
    st === ListingRequestStatus.printify_item_created ||
    st === ListingRequestStatus.approved;
  if (!listing || !allowed) return;

  if (!printifyVariantId) {
    const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
    if (isPrintifyConfigured() && shopId) {
      const detail = await fetchPrintifyProductDetail(shopId, printifyProductId);
      if (detail) {
        const def = defaultPrintifyVariantIdForCatalogProduct(detail);
        if (def) printifyVariantId = def;
      }
    }
  }

  if (!printifyVariantId) {
    console.error("[adminMarkPrintifyListingReady] missing Printify variant id", listingId);
    return;
  }

  const nextStatus =
    st === ListingRequestStatus.images_ok
      ? ListingRequestStatus.printify_item_created
      : st;

  const syncedAt = new Date();
  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      listingPrintifyProductId: printifyProductId,
      listingPrintifyVariantId: printifyVariantId || null,
      requestStatus: nextStatus,
      listingPrintifyCatalogSyncedAt: syncedAt,
    },
  });

  await syncListingProductWithPrintifyCatalog(listing.productId, {
    listingPrintifyProductId: printifyProductId,
    listingPrintifyVariantId: printifyVariantId || null,
  });

  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath(`/s/${listing.shop.slug}`);
}

function parseLegacyGroupListingIdsJson(raw: unknown): string[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw.trim() || "null") as unknown;
    if (!Array.isArray(parsed)) return null;
    const ids = [...new Set(parsed.map((x) => String(x ?? "").trim()).filter(Boolean))];
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

type AdminApproveListingExecOk = { ok: true; shopSlug: string; shopId: string };
type AdminApproveListingExecResult = AdminApproveListingExecOk | { ok: false; reason: string };

/**
 * Core approve path (no `revalidatePath`). Used by single approve and legacy multi-size batch approve.
 */
async function tryExecuteAdminApproveListingRequest(
  listingId: string,
): Promise<AdminApproveListingExecResult> {
  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    include: { shop: true },
  });
  if (!listing) return { ok: false, reason: "listing_not_found" };
  const productId = listing.productId;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { ok: false, reason: "product_not_found" };

  if (listing.requestStatus !== ListingRequestStatus.printify_item_created) {
    return { ok: false, reason: "wrong_status" };
  }
  if (!listing.listingPrintifyProductId?.trim()) {
    return { ok: false, reason: "missing_printify_product" };
  }

  let effVariant =
    listing.listingPrintifyVariantId?.trim() || product.printifyVariantId?.trim() || "";
  if (!effVariant && listing.listingPrintifyProductId?.trim()) {
    const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
    if (isPrintifyConfigured() && shopId) {
      const detail = await fetchPrintifyProductDetail(
        shopId,
        listing.listingPrintifyProductId.trim(),
      );
      if (detail) {
        const def = defaultPrintifyVariantIdForCatalogProduct(detail);
        if (def) effVariant = def;
      }
    }
  }
  if (!effVariant) {
    return { ok: false, reason: "no_printify_variant" };
  }

  await syncListingProductWithPrintifyCatalog(productId, {
    listingPrintifyProductId: listing.listingPrintifyProductId,
    listingPrintifyVariantId: effVariant || null,
  });

  const productForImages = await prisma.product.findUnique({
    where: { id: productId },
    select: { imageUrl: true, imageGallery: true },
  });
  if (!productForImages) return { ok: false, reason: "product_missing_after_sync" };
  if (productImageUrlsUnionHero(productForImages).length === 0) {
    return { ok: false, reason: "no_hero_image" };
  }

  const isPlatform = listing.shop.slug === PLATFORM_SHOP_SLUG;
  const ordinal = await getListingOrdinal(listingId, listing.shopId);
  if (ordinal === null) return { ok: false, reason: "ordinal_missing" };

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
        requestImages: [],
      },
    });
    await activateProductWhenShopListingGoesLive(productId, listing.shop.slug);
    await syncFreeListingFeeWaivers(listing.shopId);
    return { ok: true, shopSlug: listing.shop.slug, shopId: listing.shopId };
  }

  if (feeCents === 0) {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: {
        requestStatus: ListingRequestStatus.approved,
        active: true,
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

  return { ok: true, shopSlug: listing.shop.slug, shopId: listing.shopId };
}

/**
 * Step 2: approve listing (requires Printify IDs). Applies free-slot waivers, charges listing fee policy,
 * and either goes live or asks the shop to pay the publication fee.
 */
export async function adminApproveListingRequest(formData: FormData): Promise<void> {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  if (!listingId || !productId) return;

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: { productId: true },
  });
  if (!listing || listing.productId !== productId) return;

  const result = await tryExecuteAdminApproveListingRequest(listingId);
  if (!result.ok) {
    console.error("[adminApproveListingRequest]", listingId, result.reason);
    return;
  }

  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
  revalidatePath(`/s/${result.shopSlug}`);
}

export type AdminApproveListingFormState = { error: string } | null;

export async function adminApproveListingRequestFormState(
  _prev: AdminApproveListingFormState,
  formData: FormData,
): Promise<AdminApproveListingFormState> {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  if (!listingId || !productId) {
    return { error: "Missing listing or product." };
  }

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: { productId: true },
  });
  if (!listing || listing.productId !== productId) {
    return { error: "Listing does not match product." };
  }

  const result = await tryExecuteAdminApproveListingRequest(listingId);
  if (!result.ok) {
    console.error("[adminApproveListingRequestFormState]", listingId, result.reason);
    const msg =
      result.reason === "no_printify_variant"
        ? "Approve failed: could not resolve a default Printify variant. Re-save the Printify product mapping or check the Printify API."
        : result.reason === "no_hero_image"
          ? "Approve failed: no hero image after Printify sync. Check Printify product images."
          : result.reason === "wrong_status"
            ? "Approve failed: listing is not in “Printify item created” status."
            : `Approve failed (${result.reason}). Try re-saving the Printify mapping.`;
    return { error: msg };
  }

  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
  revalidatePath(`/s/${result.shopSlug}`);
  return null;
}

/** Approve every legacy split-catalog stub in one POST (same shop, oldest-first). */
export async function adminApproveLegacyVariantListingGroup(formData: FormData): Promise<void> {
  await requireAdmin();
  const listingIds = parseLegacyGroupListingIdsJson(formData.get("legacyGroupListingIdsJson"));
  if (!listingIds) return;

  const rows = await prisma.shopListing.findMany({
    where: { id: { in: listingIds } },
    include: { shop: true },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length !== listingIds.length) return;

  const shopId = rows[0]!.shopId;
  if (rows.some((r) => r.shopId !== shopId)) return;

  const shopSlugs = new Set<string>();
  for (const row of rows) {
    const result = await tryExecuteAdminApproveListingRequest(row.id);
    if (!result.ok) {
      console.error("[adminApproveLegacyVariantListingGroup]", row.id, result.reason);
      return;
    }
    shopSlugs.add(result.shopSlug);
  }

  for (const slug of shopSlugs) {
    revalidatePath(`/s/${slug}`);
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
 * Core removal (no `revalidatePath`). Used by single remove and legacy multi-size batch remove.
 * @returns true if this listing was removed from the queue.
 */
async function executeRemoveListingFromRequestsQueueOnce(listingId: string): Promise<boolean> {
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
  if (!listing || listing.removedFromListingRequestsAt) return false;

  const requestImageUrls = shopListingRequestImageUrlStrings(listing.requestImages);
  await deleteShopListingRequestImagesFromR2(listing.shopId, requestImageUrls);

  const now = new Date();
  const base = {
    removedFromListingRequestsAt: now,
  } as const;
  const productLabel = listing.product.name;

  if (listing.requestStatus === ListingRequestStatus.approved) {
    await deleteShopListingSupplementObject(listing.shopId, listingId);
    await deleteShopListingAdminSecondaryObject(listing.shopId, listingId);
    const wasLive = listing.active;
    const data: {
      removedFromListingRequestsAt: Date;
      active?: boolean;
      adminRemovedFromShopAt?: Date;
      requestImages: [];
      ownerSupplementImageUrl: null;
      adminListingSecondaryImageUrl: null;
      listingStorefrontCatalogImageUrls: typeof Prisma.DbNull;
    } = {
      ...base,
      requestImages: [],
      ownerSupplementImageUrl: null,
      adminListingSecondaryImageUrl: null,
      listingStorefrontCatalogImageUrls: Prisma.DbNull,
    };
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
    listing.requestStatus === ListingRequestStatus.images_ok ||
    listing.requestStatus === ListingRequestStatus.printify_item_created
  ) {
    await deleteShopListingAdminSecondaryObject(listing.shopId, listingId);
    await prisma.shopListing.update({
      where: { id: listingId },
      data: {
        ...base,
        requestStatus: ListingRequestStatus.rejected,
        active: false,
        listingPrintifyProductId: null,
        listingPrintifyVariantId: null,
        requestImages: [],
        adminListingSecondaryImageUrl: null,
        listingStorefrontCatalogImageUrls: Prisma.DbNull,
      },
    });
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: listing.shopId,
        kind: "listing_rejected",
        relatedListingId: listingId,
        body: `The platform removed your listing request for “${productLabel}” from review and marked it rejected. Check the Listings tab or contact support.`,
      },
    });
  } else {
    return false;
  }

  return true;
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
  if (await executeRemoveListingFromRequestsQueueOnce(listingId)) {
    revalidatePath("/admin");
    revalidatePath("/shops");
    revalidatePath("/dashboard");
  }
}

/**
 * Removes every catalog stub in a legacy multi-size group from the admin queue (one action for the whole request).
 */
export async function adminRemoveLegacyVariantListingGroupFromQueue(formData: FormData) {
  await requireAdmin();
  const listingIds = parseLegacyGroupListingIdsJson(formData.get("legacyGroupListingIdsJson"));
  if (!listingIds) return;

  const rows = await prisma.shopListing.findMany({
    where: { id: { in: listingIds } },
    select: { id: true, shopId: true },
  });
  if (rows.length !== listingIds.length) return;
  const shopId = rows[0]!.shopId;
  if (rows.some((r) => r.shopId !== shopId)) return;

  let any = false;
  for (const id of listingIds) {
    if (await executeRemoveListingFromRequestsQueueOnce(id)) any = true;
  }
  if (any) {
    revalidatePath("/admin");
    revalidatePath("/shops");
    revalidatePath("/dashboard");
  }
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
 * If the listing is **rejected** but has no removal audit (typical after “Reject” on listing requests), sets
 * `requestStatus` back to **draft** so it leaves Shop watch history and the creator can edit and resubmit.
 * Does not delete the listing row; does not change `active` except indirectly when combined with other workflows.
 */
export async function adminDeleteListingRemovalRecord(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: {
      requestStatus: true,
      adminRemovedFromShopAt: true,
      creatorRemovedFromShopAt: true,
      removedFromListingRequestsAt: true,
    },
  });
  if (!listing) return;

  const hasRemovalAudit =
    listing.adminRemovedFromShopAt != null ||
    listing.creatorRemovedFromShopAt != null ||
    listing.removedFromListingRequestsAt != null;
  const isRejected = listing.requestStatus === ListingRequestStatus.rejected;
  if (!hasRemovalAudit && !isRejected) return;

  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      adminRemovedFromShopAt: null,
      creatorRemovedFromShopAt: null,
      removedFromListingRequestsAt: null,
      adminListingRemovalNotes: null,
      ...(isRejected ? { requestStatus: ListingRequestStatus.draft } : {}),
    },
  });
  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
}

/**
 * Permanently deletes the `ShopListing` row (admin shop watch “delete”).
 * Clears `Shop.homeFeaturedListingId` when it points at this listing, removes R2 request/supplement/secondary
 * images, then deletes the listing. `OrderLine.shopListingId` is set null by FK; `Product` is kept for order history.
 */
export async function adminDeleteShopListingRecord(formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      shopId: true,
      requestImages: true,
      shop: { select: { slug: true, homeFeaturedListingId: true } },
    },
  });
  if (!listing) return;

  const requestImageUrls = shopListingRequestImageUrlStrings(listing.requestImages);
  await deleteShopListingRequestImagesFromR2(listing.shopId, requestImageUrls);
  await deleteShopListingSupplementObject(listing.shopId, listingId);
  await deleteShopListingAdminSecondaryObject(listing.shopId, listingId);

  await prisma.$transaction(async (tx) => {
    if (listing.shop.homeFeaturedListingId === listingId) {
      await tx.shop.update({
        where: { id: listing.shopId },
        data: { homeFeaturedListingId: null },
      });
    }
    await tx.shopListing.delete({ where: { id: listingId } });
  });

  await syncFreeListingFeeWaivers(listing.shopId);
  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
  revalidatePath(`/s/${listing.shop.slug}`);
}

type AdminRejectListingExecOk = { ok: true; shopId: string; productName: string };
type AdminRejectListingExecResult = AdminRejectListingExecOk | { ok: false };

async function tryExecuteAdminRejectListingWithoutNotice(
  listingId: string,
): Promise<AdminRejectListingExecResult> {
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
      listing.requestStatus !== ListingRequestStatus.images_ok &&
      listing.requestStatus !== ListingRequestStatus.printify_item_created)
  ) {
    return { ok: false };
  }
  const requestImageUrls = shopListingRequestImageUrlStrings(listing.requestImages);
  await deleteShopListingRequestImagesFromR2(listing.shopId, requestImageUrls);
  await deleteShopListingAdminSecondaryObject(listing.shopId, listingId);
  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      requestStatus: ListingRequestStatus.rejected,
      active: false,
      listingPrintifyProductId: null,
      listingPrintifyVariantId: null,
      requestImages: [],
      adminListingSecondaryImageUrl: null,
      listingStorefrontCatalogImageUrls: Prisma.DbNull,
    },
  });
  return { ok: true, shopId: listing.shopId, productName: listing.product.name };
}

export async function adminRejectListingRequest(formData: FormData): Promise<void> {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const rejectReason = parseListingRejectReason(formData.get("rejectReason"));
  if (!listingId || !rejectReason) return;

  const result = await tryExecuteAdminRejectListingWithoutNotice(listingId);
  if (!result.ok) return;

  const base = (publicAppBaseUrl() ?? emailLinkOrigin()).replace(/\/$/, "");
  const regulationsUrl = `${base}/shop-regulations`;
  const detail = listingRejectionNoticeDetail(rejectReason, regulationsUrl);
  await prisma.shopOwnerNotice.create({
    data: {
      shopId: result.shopId,
      kind: "listing_rejected",
      relatedListingId: listingId,
      body: `The platform rejected your listing request for “${result.productName}”. ${detail} Open the Listings tab for status or contact support.`,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
}

/** Reject every legacy split-catalog stub in one POST; one shop notice listing all product names. */
export async function adminRejectLegacyVariantListingGroup(formData: FormData): Promise<void> {
  await requireAdmin();
  const listingIds = parseLegacyGroupListingIdsJson(formData.get("legacyGroupListingIdsJson"));
  const rejectReason = parseListingRejectReason(formData.get("rejectReason"));
  if (!listingIds || !rejectReason) return;

  const rows = await prisma.shopListing.findMany({
    where: { id: { in: listingIds } },
    select: { id: true, shopId: true },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length !== listingIds.length) return;

  const shopId = rows[0]!.shopId;
  if (rows.some((r) => r.shopId !== shopId)) return;

  const names: string[] = [];
  for (const row of rows) {
    const result = await tryExecuteAdminRejectListingWithoutNotice(row.id);
    if (!result.ok) return;
    names.push(result.productName);
  }

  const base = (publicAppBaseUrl() ?? emailLinkOrigin()).replace(/\/$/, "");
  const regulationsUrl = `${base}/shop-regulations`;
  const detail = listingRejectionNoticeDetail(rejectReason, regulationsUrl);
  const namesJoined = names.map((n) => `“${n}”`).join(", ");
  await prisma.shopOwnerNotice.create({
    data: {
      shopId,
      kind: "listing_rejected",
      relatedListingId: rows[0]!.id,
      body: `The platform rejected your multi-size listing request (${namesJoined}). ${detail} Open the Listings tab for status or contact support.`,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/shops");
  revalidatePath("/dashboard");
}
