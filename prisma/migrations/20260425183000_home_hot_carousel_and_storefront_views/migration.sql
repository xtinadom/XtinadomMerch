-- Home hot carousel admin picks + storefront PDP view counts for fallback ordering.
ALTER TABLE "Product" ADD COLUMN "storefrontViewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN "homeHotCarouselFeaturedProductIds" JSONB;
