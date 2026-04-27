-- Bug/Feedback reports from creator dashboard (admin triage).
CREATE TABLE "BugFeedbackReport" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "happened" TEXT NOT NULL,
  "expected" TEXT NOT NULL,
  "stepsToReproduce" TEXT,
  "pageUrl" VARCHAR(2048),
  "userAgent" TEXT,
  "imageUrl" VARCHAR(2048),
  "imageR2Key" TEXT,
  "imageUploadedAt" TIMESTAMP(3),
  "imageDeletedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BugFeedbackReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BugFeedbackReport"
  ADD CONSTRAINT "BugFeedbackReport_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BugFeedbackReport_shopId_createdAt_idx" ON "BugFeedbackReport"("shopId", "createdAt");
CREATE INDEX "BugFeedbackReport_resolvedAt_idx" ON "BugFeedbackReport"("resolvedAt");
CREATE INDEX "BugFeedbackReport_imageUploadedAt_idx" ON "BugFeedbackReport"("imageUploadedAt");

