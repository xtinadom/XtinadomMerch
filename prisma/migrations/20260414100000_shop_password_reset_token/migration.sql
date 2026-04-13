-- CreateTable
CREATE TABLE "ShopPasswordResetToken" (
    "id" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopPasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopPasswordResetToken_tokenHash_key" ON "ShopPasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ShopPasswordResetToken_shopUserId_idx" ON "ShopPasswordResetToken"("shopUserId");

-- AddForeignKey
ALTER TABLE "ShopPasswordResetToken" ADD CONSTRAINT "ShopPasswordResetToken_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
