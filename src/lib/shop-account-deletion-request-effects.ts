import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  deleteListingImagesFromR2,
  deleteR2ObjectsByKeys,
  isR2UploadConfigured,
  listR2ObjectKeysWithPrefix,
} from "@/lib/r2-upload";

function storefrontCatalogImageUrlsFromRows(
  rows: { listingStorefrontCatalogImageUrls: unknown }[],
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const j = row.listingStorefrontCatalogImageUrls;
    if (!Array.isArray(j)) continue;
    for (const x of j) {
      if (typeof x === "string" && x.trim()) out.push(x.trim());
    }
  }
  return out;
}

/**
 * Deletes shop-owned objects under `shops/{shopId}/` on R2, plus any `listing/…` objects referenced
 * by `listingStorefrontCatalogImageUrls` (subset picks stored as URLs).
 */
export async function purgeShopUploadedMediaFromR2(shopId: string): Promise<void> {
  if (!isR2UploadConfigured()) return;

  const rows = await prisma.shopListing.findMany({
    where: { shopId },
    select: { listingStorefrontCatalogImageUrls: true },
  });
  const catalogUrls = storefrontCatalogImageUrlsFromRows(rows);
  if (catalogUrls.length > 0) {
    await deleteListingImagesFromR2(catalogUrls);
  }

  let prefixKeys: string[] = [];
  try {
    prefixKeys = await listR2ObjectKeysWithPrefix(`shops/${shopId}/`);
  } catch {
    /* best-effort */
  }
  if (prefixKeys.length > 0) {
    await deleteR2ObjectsByKeys(prefixKeys);
  }
}

/**
 * Initial “request deletion” step only: hide the shop from browse and record the timestamp.
 * Listings and photos stay until {@link purgeShopUploadedMediaFromR2} + {@link applyVerifiedAccountDeletionListingAndMediaCleanup}
 * run after the owner confirms via email link.
 */
export async function hideShopForPendingAccountDeletion(
  shopId: string,
  now: Date = new Date(),
): Promise<void> {
  await prisma.shop.update({
    where: { id: shopId },
    data: {
      active: false,
      accountDeletionRequestedAt: now,
      homeFeaturedListingId: null,
    },
  });
}

/**
 * Runs after the account-deletion confirmation link is used (`accountDeletionEmailConfirmedAt` already set).
 * Clears listing image fields and shop profile URL in the DB after {@link purgeShopUploadedMediaFromR2}.
 * Does not modify `accountDeletionRequestedAt` / `accountDeletionEmailConfirmedAt`.
 */
export async function applyVerifiedAccountDeletionListingAndMediaCleanup(
  shopId: string,
  now: Date = new Date(),
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.shopListing.updateMany({
      where: { shopId, active: true },
      data: {
        active: false,
        hiddenStorefrontForAccountDeletionAt: now,
      },
    });

    await tx.shopListing.updateMany({
      where: { shopId },
      data: {
        featuredOnShop: false,
        featuredForHome: false,
        ownerSupplementImageUrl: null,
        adminListingSecondaryImageUrl: null,
        requestImages: Prisma.JsonNull,
        listingStorefrontCatalogImageUrls: Prisma.JsonNull,
      },
    });

    await tx.shop.update({
      where: { id: shopId },
      data: {
        active: false,
        homeFeaturedListingId: null,
        profileImageUrl: null,
      },
    });
  });
}

/**
 * Restores listings that were storefront-active before a deletion request, when the owner cancels
 * before completing deletion (typically before email confirmation).
 */
export async function restoreListingsAfterAccountDeletionRequestCancel(shopId: string): Promise<void> {
  await prisma.shopListing.updateMany({
    where: { shopId, hiddenStorefrontForAccountDeletionAt: { not: null } },
    data: {
      active: true,
      hiddenStorefrontForAccountDeletionAt: null,
    },
  });
}
