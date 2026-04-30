-- Add indexes to speed up dashboard Promotions payload queries.
-- - kind/status/eligibleFrom and kind/status/paidAt are used by placement-period slot counting
-- - shopId/createdAt desc already exists for dashboard listing

CREATE INDEX IF NOT EXISTS "PromotionPurchase_kind_status_eligibleFrom_idx"
ON "PromotionPurchase" ("kind", "status", "eligibleFrom");

CREATE INDEX IF NOT EXISTS "PromotionPurchase_kind_status_paidAt_idx"
ON "PromotionPurchase" ("kind", "status", "paidAt");

