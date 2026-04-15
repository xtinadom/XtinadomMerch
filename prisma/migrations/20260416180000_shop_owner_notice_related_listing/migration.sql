-- AlterTable
ALTER TABLE "ShopOwnerNotice" ADD COLUMN "relatedListingId" TEXT;

-- CreateIndex
CREATE INDEX "ShopOwnerNotice_relatedListingId_idx" ON "ShopOwnerNotice"("relatedListingId");

-- AddForeignKey
ALTER TABLE "ShopOwnerNotice" ADD CONSTRAINT "ShopOwnerNotice_relatedListingId_fkey" FOREIGN KEY ("relatedListingId") REFERENCES "ShopListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
