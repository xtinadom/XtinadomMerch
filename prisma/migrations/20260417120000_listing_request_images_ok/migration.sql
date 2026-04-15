-- AlterEnum
ALTER TYPE "ListingRequestStatus" ADD VALUE 'images_ok';

-- Existing in-queue submissions skip the new "mark images OK" click once.
UPDATE "ShopListing"
SET "requestStatus" = 'images_ok'
WHERE "requestStatus" = 'submitted';
