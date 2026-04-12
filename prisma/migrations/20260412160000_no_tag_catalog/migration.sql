-- Canonical “No tag” label for listings without a user-chosen type tag.

INSERT INTO "Tag" (
  "id",
  "slug",
  "name",
  "sortOrder",
  "subCollectionSpotlightProductId",
  "dommeCollectionSpotlightProductId",
  "createdAt",
  "updatedAt"
)
VALUES (
  'tag_no_tag_catalog',
  'no-tag',
  'No tag',
  9999,
  NULL,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

-- Products with no ProductTag rows: attach primary tag if set, otherwise “No tag”.
INSERT INTO "ProductTag" ("productId", "tagId")
SELECT
  p."id",
  COALESCE(p."primaryTagId", (SELECT "id" FROM "Tag" WHERE "slug" = 'no-tag' LIMIT 1))
FROM "Product" p
WHERE
  NOT EXISTS (SELECT 1 FROM "ProductTag" pt WHERE pt."productId" = p."id")
  AND COALESCE(p."primaryTagId", (SELECT "id" FROM "Tag" WHERE "slug" = 'no-tag' LIMIT 1)) IS NOT NULL;

UPDATE "Product" p
SET "primaryTagId" = (SELECT "id" FROM "Tag" WHERE "slug" = 'no-tag' LIMIT 1)
WHERE
  p."primaryTagId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "ProductTag" pt
    WHERE
      pt."productId" = p."id"
      AND pt."tagId" = (SELECT "id" FROM "Tag" WHERE "slug" = 'no-tag' LIMIT 1)
  );
