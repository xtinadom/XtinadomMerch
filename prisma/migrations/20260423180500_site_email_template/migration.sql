-- Optional overrides for automated site emails (admin Email format tab).
CREATE TABLE "SiteEmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT,
    "htmlBody" TEXT,
    "textBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteEmailTemplate_key_key" ON "SiteEmailTemplate"("key");
