-- One-time backfill: approved listings should be storefront-live (listing + catalog product active).
-- Skips creator-removed, admin-frozen, and account-deletion-hidden rows.
-- Does not modify listing fees or payment timestamps.

UPDATE "ShopListing"
SET "active" = true
WHERE "requestStatus" = 'approved'
  AND "creatorRemovedFromShopAt" IS NULL
  AND "adminRemovedFromShopAt" IS NULL
  AND "hiddenStorefrontForAccountDeletionAt" IS NULL
  AND "active" = false;

UPDATE "Product" AS p
SET "active" = true
FROM "ShopListing" AS sl
WHERE sl."productId" = p."id"
  AND sl."requestStatus" = 'approved'
  AND sl."creatorRemovedFromShopAt" IS NULL
  AND sl."adminRemovedFromShopAt" IS NULL
  AND sl."hiddenStorefrontForAccountDeletionAt" IS NULL
  AND p."active" = false;
