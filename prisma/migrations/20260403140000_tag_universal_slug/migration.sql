-- Universal tags: one row per slug (merge sub/domme duplicates), then drop collection.

CREATE TEMP TABLE _tag_merge AS
WITH ranked AS (
  SELECT
    id,
    slug,
    FIRST_VALUE(id) OVER (PARTITION BY LOWER(slug) ORDER BY id) AS canonical_id
  FROM "Tag"
)
SELECT id AS old_id, canonical_id
FROM ranked;

UPDATE "ProductTag" pt
SET "tagId" = m.canonical_id
FROM _tag_merge m
WHERE pt."tagId" = m.old_id AND m.old_id <> m.canonical_id;

DELETE FROM "ProductTag" a
USING "ProductTag" b
WHERE a."productId" = b."productId"
  AND a."tagId" = b."tagId"
  AND a.ctid > b.ctid;

UPDATE "Product" p
SET "primaryTagId" = m.canonical_id
FROM _tag_merge m
WHERE p."primaryTagId" = m.old_id AND m.old_id <> m.canonical_id;

DELETE FROM "Tag" t
USING _tag_merge m
WHERE t.id = m.old_id AND m.old_id <> m.canonical_id;

DROP TABLE _tag_merge;

DROP INDEX "Tag_collection_slug_key";

ALTER TABLE "Tag" DROP COLUMN "collection";

CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");
