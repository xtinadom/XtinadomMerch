import { prisma } from "@/lib/prisma";
import { productAllStoredImageUrls } from "@/lib/product-media";
import {
  deleteR2ObjectsByKeys,
  isR2UploadConfigured,
  listR2ObjectKeysWithPrefix,
  publicUrlToR2ObjectKey,
} from "@/lib/r2-upload";

const LISTING_PREFIX = "listing/";

function addPublicUrlToListingKeys(
  url: string | null | undefined,
  keys: Set<string>,
): void {
  const u = url?.trim();
  if (!u) return;
  const key = publicUrlToR2ObjectKey(u);
  if (key && key.startsWith(LISTING_PREFIX)) {
    keys.add(key);
  }
}

/**
 * R2 object keys under `listing/` referenced by product hero, gallery JSON, and Printify variant thumbnails.
 */
export async function collectReferencedListingKeysFromDatabase(): Promise<Set<string>> {
  const products = await prisma.product.findMany({
    select: {
      imageUrl: true,
      imageGallery: true,
      printifyVariants: true,
    },
  });
  const keys = new Set<string>();
  for (const p of products) {
    for (const url of productAllStoredImageUrls(p)) {
      addPublicUrlToListingKeys(url, keys);
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
 * List all `listing/*` objects in R2 and delete those not referenced by any product row.
 */
export async function pruneOrphanListingImagesFromR2(options: {
  dryRun: boolean;
}): Promise<PruneOrphanListingImagesResult> {
  if (!isR2UploadConfigured()) {
    throw new Error("R2 is not configured");
  }
  const referenced = await collectReferencedListingKeysFromDatabase();
  const allKeys = await listR2ObjectKeysWithPrefix(LISTING_PREFIX);
  const orphans = allKeys.filter((k) => !referenced.has(k));
  let deletedCount = 0;
  if (!options.dryRun && orphans.length > 0) {
    deletedCount = await deleteR2ObjectsByKeys(orphans);
  }
  return {
    listedObjectCount: allKeys.length,
    referencedKeyCount: referenced.size,
    orphanKeyCount: orphans.length,
    orphanKeysSample: orphans.slice(0, ORPHAN_SAMPLE_MAX),
    deletedCount,
  };
}
