-- When set, listing placement benefits begin at this instant (e.g. next calendar month for reserved slots).
-- When null, benefits begin at payment time (`paidAt`). Active window length is defined in app code (30 days).
ALTER TABLE "PromotionPurchase" ADD COLUMN "eligibleFrom" TIMESTAMP(3);
