-- Split single By Item spotlight into Sub vs Domme collection picks.

ALTER TABLE "Tag" ADD COLUMN "subCollectionSpotlightProductId" TEXT;
ALTER TABLE "Tag" ADD COLUMN "dommeCollectionSpotlightProductId" TEXT;

UPDATE "Tag"
SET
  "subCollectionSpotlightProductId" = "spotlightProductId",
  "dommeCollectionSpotlightProductId" = "spotlightProductId"
WHERE "spotlightProductId" IS NOT NULL;

ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_spotlightProductId_fkey";
ALTER TABLE "Tag" DROP COLUMN IF EXISTS "spotlightProductId";

ALTER TABLE "Tag" ADD CONSTRAINT "Tag_subCollectionSpotlightProductId_fkey"
  FOREIGN KEY ("subCollectionSpotlightProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tag" ADD CONSTRAINT "Tag_dommeCollectionSpotlightProductId_fkey"
  FOREIGN KEY ("dommeCollectionSpotlightProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
