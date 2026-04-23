-- Track listings that were storefront-active before an account deletion request so we can restore them if the creator cancels before email confirmation.
ALTER TABLE "ShopListing" ADD COLUMN "hiddenStorefrontForAccountDeletionAt" TIMESTAMP(3);
