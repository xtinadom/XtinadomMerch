-- Optional per-item artwork resolution: label for display + minimum long-edge pixels (DPI proxy at print size).
ALTER TABLE "AdminCatalogItem" ADD COLUMN IF NOT EXISTS "itemImageRequirementLabel" VARCHAR(400);
ALTER TABLE "AdminCatalogItem" ADD COLUMN IF NOT EXISTS "itemMinArtworkLongEdgePx" INTEGER;
