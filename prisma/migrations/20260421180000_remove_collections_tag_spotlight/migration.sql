-- Legacy “sub” / “domme” collection spotlights on Tag → single By Item pick.
-- Drop unused CatalogGroup enum (no columns reference it anymore).

ALTER TABLE "Tag" ADD COLUMN "byItemSpotlightProductId" TEXT;

UPDATE "Tag"
SET "byItemSpotlightProductId" = COALESCE(
  "subCollectionSpotlightProductId",
  "dommeCollectionSpotlightProductId"
)
WHERE "subCollectionSpotlightProductId" IS NOT NULL
   OR "dommeCollectionSpotlightProductId" IS NOT NULL;

ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_subCollectionSpotlightProductId_fkey";
ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_dommeCollectionSpotlightProductId_fkey";

ALTER TABLE "Tag" DROP COLUMN "subCollectionSpotlightProductId";
ALTER TABLE "Tag" DROP COLUMN "dommeCollectionSpotlightProductId";

ALTER TABLE "Tag"
  ADD CONSTRAINT "Tag_byItemSpotlightProductId_fkey"
  FOREIGN KEY ("byItemSpotlightProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TYPE IF EXISTS "CatalogGroup";
