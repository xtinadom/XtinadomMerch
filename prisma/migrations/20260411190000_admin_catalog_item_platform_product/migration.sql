-- Optional explicit Product link for Admin → List rows (shop catalog when example URL / name match is unused).
ALTER TABLE "AdminCatalogItem" ADD COLUMN "itemPlatformProductId" TEXT;

ALTER TABLE "AdminCatalogItem"
  ADD CONSTRAINT "AdminCatalogItem_itemPlatformProductId_fkey"
  FOREIGN KEY ("itemPlatformProductId") REFERENCES "Product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
