-- Persist baseline catalog picker token for listings whose stub product slug is unique per row
-- (allows multiple shop listings of the same admin catalog item).
ALTER TABLE "ShopListing" ADD COLUMN IF NOT EXISTS "baselineCatalogPickEncoded" TEXT;
