-- Per Printify variant shop prices (JSON object: variant id string -> cents int).
ALTER TABLE "ShopListing" ADD COLUMN IF NOT EXISTS "listingPrintifyVariantPrices" JSONB;
