-- Per baseline catalog item (no variants): Printify / fulfillment COGS retained by platform (cents).
ALTER TABLE "AdminCatalogItem" ADD COLUMN "itemGoodsServicesCostCents" INTEGER NOT NULL DEFAULT 0;

-- Snapshot per paid order line: total goods/services cost for the line (unit cost × qty, capped to merch).
ALTER TABLE "OrderLine" ADD COLUMN "goodsServicesCostCents" INTEGER NOT NULL DEFAULT 0;
