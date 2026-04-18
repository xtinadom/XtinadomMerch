-- Track admin “resolved” state per support thread; cleared when the creator posts again.
ALTER TABLE "SupportThread" ADD COLUMN "resolvedAt" TIMESTAMP(3);
