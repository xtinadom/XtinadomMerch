-- Optional print-area pixel size for listing artwork crop + validation (baseline catalog).
ALTER TABLE "AdminCatalogItem" ADD COLUMN "itemPrintAreaWidthPx" INTEGER;
ALTER TABLE "AdminCatalogItem" ADD COLUMN "itemPrintAreaHeightPx" INTEGER;
