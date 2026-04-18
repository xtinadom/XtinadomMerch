import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";
import { prisma } from "@/lib/prisma";
import { productAllStoredImageUrls } from "@/lib/product-media";
import {
  deleteR2ObjectsByKeysForPrune,
  isR2UploadConfigured,
  listAllR2ObjectKeys,
  publicUrlToR2ObjectKey,
  shopListingRequestImageUrlStrings,
} from "@/lib/r2-upload";

function addUrlToReferencedR2Keys(url: string | null | undefined, keys: Set<string>): void {
  const u = url?.trim();
  if (!u) return;
  const key = publicUrlToR2ObjectKey(u);
  if (key) keys.add(key);
}

function addJsonStringArrayUrls(json: unknown, keys: Set<string>): void {
  if (!Array.isArray(json)) return;
  for (const x of json) {
    if (typeof x === "string") addUrlToReferencedR2Keys(x, keys);
  }
}

/**
 * R2 object keys referenced from the database (any path under `R2_PUBLIC_BASE_URL` that
 * {@link publicUrlToR2ObjectKey} can resolve).
 */
export async function collectReferencedR2ObjectKeysFromDatabase(): Promise<Set<string>> {
  const keys = new Set<string>();

  const products = await prisma.product.findMany({
    select: {
      imageUrl: true,
      imageGallery: true,
      printifyVariants: true,
    },
  });
  for (const p of products) {
    for (const url of productAllStoredImageUrls(p)) {
      addUrlToReferencedR2Keys(url, keys);
    }
  }

  const shops = await prisma.shop.findMany({
    select: { profileImageUrl: true },
  });
  for (const s of shops) {
    addUrlToReferencedR2Keys(s.profileImageUrl, keys);
  }

  const listings = await prisma.shopListing.findMany({
    select: {
      requestImages: true,
      ownerSupplementImageUrl: true,
      adminListingSecondaryImageUrl: true,
      listingStorefrontCatalogImageUrls: true,
    },
  });
  for (const l of listings) {
    for (const u of shopListingRequestImageUrlStrings(l.requestImages)) {
      addUrlToReferencedR2Keys(u, keys);
    }
    addUrlToReferencedR2Keys(l.ownerSupplementImageUrl, keys);
    addUrlToReferencedR2Keys(l.adminListingSecondaryImageUrl, keys);
    addJsonStringArrayUrls(l.listingStorefrontCatalogImageUrls, keys);
  }

  const catalogItems = await prisma.adminCatalogItem.findMany({
    select: { itemExampleListingUrl: true, variants: true },
  });
  for (const row of catalogItems) {
    addUrlToReferencedR2Keys(row.itemExampleListingUrl, keys);
    for (const v of parseAdminCatalogVariantsJson(row.variants)) {
      addUrlToReferencedR2Keys(v.exampleListingUrl, keys);
    }
  }

  return keys;
}

export type PruneOrphanListingImagesResult = {
  listedObjectCount: number;
  referencedKeyCount: number;
  orphanKeyCount: number;
  orphanKeysSample: string[];
  deletedCount: number;
};

const ORPHAN_SAMPLE_MAX = 40;

/**
 * List every object in the R2 bucket and delete keys not referenced from the database
 * (products, shops, shop listings, admin catalog example URLs that resolve to this bucket).
 */
export async function pruneOrphanListingImagesFromR2(options: {
  dryRun: boolean;
}): Promise<PruneOrphanListingImagesResult> {
  if (!isR2UploadConfigured()) {
    throw new Error("R2 is not configured");
  }
  const referenced = await collectReferencedR2ObjectKeysFromDatabase();
  const allKeys = await listAllR2ObjectKeys();
  const orphans = allKeys.filter((k) => !referenced.has(k));
  let deletedCount = 0;
  if (!options.dryRun && orphans.length > 0) {
    deletedCount = await deleteR2ObjectsByKeysForPrune(orphans);
  }
  return {
    listedObjectCount: allKeys.length,
    referencedKeyCount: referenced.size,
    orphanKeyCount: orphans.length,
    orphanKeysSample: orphans.slice(0, ORPHAN_SAMPLE_MAX),
    deletedCount,
  };
}
