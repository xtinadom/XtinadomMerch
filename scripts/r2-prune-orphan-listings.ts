/**
 * Remove R2 objects under `listing/` that are not referenced by any product
 * (imageUrl, imageGallery, or Printify variant imageUrl fields).
 *
 * Usage (repo root, requires DATABASE_URL + R2 env like test-r2-upload):
 *   npx tsx scripts/r2-prune-orphan-listings.ts           # dry-run (report only)
 *   npx tsx scripts/r2-prune-orphan-listings.ts --execute # delete orphans
 */

import { config } from "dotenv";
import { pruneOrphanListingImagesFromR2 } from "../src/lib/r2-listing-prune";
import { isR2UploadConfigured } from "../src/lib/r2-upload";

config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const execute = process.argv.includes("--execute");
  if (!isR2UploadConfigured()) {
    console.error("[r2-prune] R2 is not configured (.env.local).");
    process.exit(1);
  }

  console.log(execute ? "[r2-prune] Deleting orphans…" : "[r2-prune] Dry run (no deletes)…");
  const r = await pruneOrphanListingImagesFromR2({ dryRun: !execute });
  console.log(
    JSON.stringify(
      {
        listedObjectCount: r.listedObjectCount,
        referencedKeyCount: r.referencedKeyCount,
        orphanKeyCount: r.orphanKeyCount,
        deletedCount: r.deletedCount,
        orphanKeysSample: r.orphanKeysSample,
      },
      null,
      2,
    ),
  );
  if (!execute && r.orphanKeyCount > 0) {
    console.log("\n[r2-prune] Re-run with --execute to delete these objects.");
  }
}

void main().catch((e) => {
  console.error("[r2-prune] Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
