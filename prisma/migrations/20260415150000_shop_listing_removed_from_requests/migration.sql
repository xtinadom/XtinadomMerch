-- AlterTable
ALTER TABLE "ShopListing" ADD COLUMN "removedFromListingRequestsAt" TIMESTAMP(3),
ADD COLUMN "adminListingRemovalNotes" TEXT;

-- CreateIndex
CREATE INDEX "ShopListing_removedFromListingRequestsAt_idx" ON "ShopListing"("removedFromListingRequestsAt");
