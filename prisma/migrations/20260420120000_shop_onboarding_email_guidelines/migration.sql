-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "itemGuidelinesAcknowledgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ShopUser" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ShopEmailVerificationToken" (
    "id" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopEmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopEmailVerificationToken_tokenHash_key" ON "ShopEmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ShopEmailVerificationToken_shopUserId_idx" ON "ShopEmailVerificationToken"("shopUserId");

-- AddForeignKey
ALTER TABLE "ShopEmailVerificationToken" ADD CONSTRAINT "ShopEmailVerificationToken_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
