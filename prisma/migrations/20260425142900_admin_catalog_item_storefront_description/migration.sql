-- Add optional public description for admin baseline catalog items.
ALTER TABLE "AdminCatalogItem"
ADD COLUMN "storefrontDescription" TEXT;

