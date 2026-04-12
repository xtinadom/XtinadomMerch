-- CreateEnum
CREATE TYPE "ListingRequestStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ShopUserRole" AS ENUM ('owner');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shopId" TEXT;

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "platformCutCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shopCutCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shopId" TEXT,
ADD COLUMN     "shopListingId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "minPriceCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "bio" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stripeConnectAccountId" TEXT,
    "connectChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "editorialPriority" INTEGER,
    "editorialPinnedUntil" TIMESTAMP(3),
    "totalSalesCents" INTEGER NOT NULL DEFAULT 0,
    "homeFeaturedListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "role" "ShopUserRole" NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopListing" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "featuredOnShop" BOOLEAN NOT NULL DEFAULT false,
    "featuredForHome" BOOLEAN NOT NULL DEFAULT false,
    "listingFeePaidAt" TIMESTAMP(3),
    "requestImages" JSONB,
    "requestStatus" "ListingRequestStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_stripeConnectAccountId_key" ON "Shop"("stripeConnectAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_homeFeaturedListingId_key" ON "Shop"("homeFeaturedListingId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopUser_email_key" ON "ShopUser"("email");

-- CreateIndex
CREATE INDEX "ShopListing_shopId_active_idx" ON "ShopListing"("shopId", "active");

-- CreateIndex
CREATE INDEX "ShopListing_requestStatus_idx" ON "ShopListing"("requestStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ShopListing_shopId_productId_key" ON "ShopListing"("shopId", "productId");

-- CreateIndex
CREATE INDEX "Order_shopId_idx" ON "Order"("shopId");

-- CreateIndex
CREATE INDEX "OrderLine_shopId_idx" ON "OrderLine"("shopId");

-- CreateIndex
CREATE INDEX "OrderLine_shopListingId_idx" ON "OrderLine"("shopListingId");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_homeFeaturedListingId_fkey" FOREIGN KEY ("homeFeaturedListingId") REFERENCES "ShopListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopUser" ADD CONSTRAINT "ShopUser_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopListing" ADD CONSTRAINT "ShopListing_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopListing" ADD CONSTRAINT "ShopListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_shopListingId_fkey" FOREIGN KEY ("shopListingId") REFERENCES "ShopListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Platform catalog shop + listings (legacy single-tenant catalog)
INSERT INTO "Shop" ("id", "slug", "displayName", "profileImageUrl", "bio", "active", "stripeConnectAccountId", "connectChargesEnabled", "payoutsEnabled", "editorialPriority", "editorialPinnedUntil", "totalSalesCents", "homeFeaturedListingId", "createdAt", "updatedAt")
VALUES (
  'cm_platform_catalog_xtna1',
  'platform',
  'XtinaDom Merch',
  NULL,
  NULL,
  true,
  NULL,
  false,
  false,
  NULL,
  NULL,
  0,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "ShopListing" ("id", "shopId", "productId", "priceCents", "active", "featuredOnShop", "featuredForHome", "listingFeePaidAt", "requestImages", "requestStatus", "createdAt", "updatedAt")
SELECT
  'sl_' || p."id",
  'cm_platform_catalog_xtna1',
  p."id",
  p."priceCents",
  p."active",
  false,
  false,
  CURRENT_TIMESTAMP,
  NULL,
  'approved',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" p;

UPDATE "Product" SET "minPriceCents" = "priceCents" WHERE "minPriceCents" = 0;

UPDATE "Order" SET "shopId" = 'cm_platform_catalog_xtna1' WHERE "shopId" IS NULL;

UPDATE "OrderLine" ol
SET
  "shopId" = 'cm_platform_catalog_xtna1',
  "shopListingId" = sl."id",
  "platformCutCents" = ol."unitPriceCents" * ol."quantity",
  "shopCutCents" = 0
FROM "ShopListing" sl
WHERE sl."productId" = ol."productId" AND sl."shopId" = 'cm_platform_catalog_xtna1';
