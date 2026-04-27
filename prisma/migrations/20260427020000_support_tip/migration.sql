-- Voluntary platform support tips (Stripe Checkout sessions with metadata.kind='support_tip').
CREATE TABLE "SupportTip" (
  "id" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportTip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportTip_stripeCheckoutSessionId_key" ON "SupportTip"("stripeCheckoutSessionId");
CREATE INDEX "SupportTip_createdAt_idx" ON "SupportTip"("createdAt");

