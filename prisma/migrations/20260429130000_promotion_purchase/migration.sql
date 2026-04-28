-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('FRONT_PAGE_ITEM', 'HOT_FEATURED_ITEM', 'MOST_POPULAR_OF_TAG_ITEM', 'FEATURED_SHOP_HOME');

-- CreateEnum
CREATE TYPE "PromotionPurchaseStatus" AS ENUM ('pending', 'paid', 'canceled', 'failed');

-- CreateTable
CREATE TABLE "PromotionPurchase" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "shopListingId" TEXT,
    "tagId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PromotionPurchaseStatus" NOT NULL DEFAULT 'pending',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromotionPurchase_stripePaymentIntentId_key" ON "PromotionPurchase"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "PromotionPurchase_shopId_createdAt_idx" ON "PromotionPurchase"("shopId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PromotionPurchase" ADD CONSTRAINT "PromotionPurchase_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionPurchase" ADD CONSTRAINT "PromotionPurchase_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionPurchase" ADD CONSTRAINT "PromotionPurchase_shopListingId_fkey" FOREIGN KEY ("shopListingId") REFERENCES "ShopListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionPurchase" ADD CONSTRAINT "PromotionPurchase_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
