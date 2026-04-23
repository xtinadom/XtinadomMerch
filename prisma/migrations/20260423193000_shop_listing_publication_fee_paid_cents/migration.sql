-- Persist the publication fee amount when paid (Stripe PI / mock / free-slot waiver), for admin reporting.
ALTER TABLE "ShopListing" ADD COLUMN "listingPublicationFeePaidCents" INTEGER;
