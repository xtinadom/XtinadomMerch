-- AlterTable
ALTER TABLE "AdminCatalogItem" ADD COLUMN "itemExampleListingUrl" VARCHAR(2048),
ADD COLUMN "itemMinPriceCents" INTEGER NOT NULL DEFAULT 0;
