-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "listingFeeBonusFreeSlots" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ShopListingSlotPromoRedemption" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "couponCodeNormalized" TEXT NOT NULL,
    "slotsGranted" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopListingSlotPromoRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopListingSlotPromoRedemption_shopId_couponCodeNormalized_key" ON "ShopListingSlotPromoRedemption"("shopId", "couponCodeNormalized");

-- CreateIndex
CREATE INDEX "ShopListingSlotPromoRedemption_couponCodeNormalized_idx" ON "ShopListingSlotPromoRedemption"("couponCodeNormalized");

-- AddForeignKey
ALTER TABLE "ShopListingSlotPromoRedemption" ADD CONSTRAINT "ShopListingSlotPromoRedemption_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
