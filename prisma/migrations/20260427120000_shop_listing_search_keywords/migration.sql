-- Shop-owned search hints for browse/discovery (distinct from admin Tags).
ALTER TABLE "ShopListing" ADD COLUMN "listingSearchKeywords" VARCHAR(2000);
