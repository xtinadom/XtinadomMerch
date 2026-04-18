-- Shop pause + self-serve account deletion request / email confirmation
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "ownerPausedShopAt" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "accountDeletionRequestedAt" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "accountDeletionEmailConfirmedAt" TIMESTAMP(3);

CREATE TABLE "ShopAccountDeletionToken" (
    "id" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopAccountDeletionToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopAccountDeletionToken_tokenHash_key" ON "ShopAccountDeletionToken"("tokenHash");
CREATE INDEX "ShopAccountDeletionToken_shopUserId_idx" ON "ShopAccountDeletionToken"("shopUserId");

ALTER TABLE "ShopAccountDeletionToken" ADD CONSTRAINT "ShopAccountDeletionToken_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
