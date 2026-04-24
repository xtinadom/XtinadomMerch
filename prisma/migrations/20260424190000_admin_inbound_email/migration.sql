-- CreateTable
CREATE TABLE "AdminInboundEmail" (
    "id" TEXT NOT NULL,
    "resendEmailId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminInboundEmail_resendEmailId_key" ON "AdminInboundEmail"("resendEmailId");

-- CreateIndex
CREATE INDEX "AdminInboundEmail_receivedAt_idx" ON "AdminInboundEmail"("receivedAt" DESC);
