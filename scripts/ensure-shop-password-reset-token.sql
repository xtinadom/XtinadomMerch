-- Idempotent: safe if migration history says "applied" but the table was never created (e.g. DB restore).
CREATE TABLE IF NOT EXISTS "ShopPasswordResetToken" (
    "id" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopPasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopPasswordResetToken_tokenHash_key" ON "ShopPasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "ShopPasswordResetToken_shopUserId_idx" ON "ShopPasswordResetToken"("shopUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShopPasswordResetToken_shopUserId_fkey'
  ) THEN
    ALTER TABLE "ShopPasswordResetToken"
      ADD CONSTRAINT "ShopPasswordResetToken_shopUserId_fkey"
      FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
