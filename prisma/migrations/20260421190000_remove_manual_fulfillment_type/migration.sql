-- Drop manual fulfillment; all rows use printify in application code.

UPDATE "Product" SET "fulfillmentType" = 'printify' WHERE "fulfillmentType" = 'manual';
UPDATE "OrderLine" SET "fulfillmentType" = 'printify' WHERE "fulfillmentType" = 'manual';

ALTER TYPE "FulfillmentType" RENAME TO "FulfillmentType_old";
CREATE TYPE "FulfillmentType" AS ENUM ('printify');

ALTER TABLE "Product"
  ALTER COLUMN "fulfillmentType" TYPE "FulfillmentType" USING ('printify'::"FulfillmentType");

ALTER TABLE "OrderLine"
  ALTER COLUMN "fulfillmentType" TYPE "FulfillmentType" USING ('printify'::"FulfillmentType");

DROP TYPE "FulfillmentType_old";
