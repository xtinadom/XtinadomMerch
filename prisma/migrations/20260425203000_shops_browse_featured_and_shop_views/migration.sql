ALTER TABLE "Shop" ADD COLUMN "storefrontViewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN "browseShopsPageFeaturedShopIds" JSONB;
