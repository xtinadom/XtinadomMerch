-- AlterTable
ALTER TABLE "Tag" ADD COLUMN "spotlightProductId" TEXT;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_spotlightProductId_fkey" FOREIGN KEY ("spotlightProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
