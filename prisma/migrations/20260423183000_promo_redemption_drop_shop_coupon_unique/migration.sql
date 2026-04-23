-- Drop unique (shopId, couponCodeNormalized) so repeatable shop-scoped promos can insert multiple rows.
DROP INDEX IF EXISTS "ShopListingSlotPromoRedemption_shopId_couponCodeNormalized_key";

-- Non-unique index for lookups and auditing.
CREATE INDEX IF NOT EXISTS "ShopListingSlotPromoRedemption_shopId_couponCodeNormalized_idx" ON "ShopListingSlotPromoRedemption"("shopId", "couponCodeNormalized");
