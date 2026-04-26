-- Ordered platform-catalog picks for /shop/all featured carousel (max 10; app-enforced).
ALTER TABLE "Shop" ADD COLUMN "browseAllPageFeaturedProductIds" JSONB;
