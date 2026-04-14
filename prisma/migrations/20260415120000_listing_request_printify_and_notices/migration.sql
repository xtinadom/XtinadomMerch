-- AlterEnum
ALTER TYPE "ListingRequestStatus" ADD VALUE 'printify_item_created';

-- AlterTable
ALTER TABLE "ShopListing" ADD COLUMN "listingPrintifyProductId" TEXT,
ADD COLUMN "listingPrintifyVariantId" TEXT;

-- CreateTable
CREATE TABLE "ShopOwnerNotice" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'listing_approved',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopOwnerNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopOwnerNotice_shopId_readAt_idx" ON "ShopOwnerNotice"("shopId", "readAt");

-- AddForeignKey
ALTER TABLE "ShopOwnerNotice" ADD CONSTRAINT "ShopOwnerNotice_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
