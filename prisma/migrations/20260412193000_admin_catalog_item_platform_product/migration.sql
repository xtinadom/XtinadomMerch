-- Optional explicit Product link for Admin → List rows (shop catalog when example URL / name match is unused).
-- Idempotent: local DBs may already have this column from the mis-ordered migration name before 20260412193000.
ALTER TABLE "AdminCatalogItem" ADD COLUMN IF NOT EXISTS "itemPlatformProductId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminCatalogItem_itemPlatformProductId_fkey'
  ) THEN
    ALTER TABLE "AdminCatalogItem"
      ADD CONSTRAINT "AdminCatalogItem_itemPlatformProductId_fkey"
      FOREIGN KEY ("itemPlatformProductId") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
