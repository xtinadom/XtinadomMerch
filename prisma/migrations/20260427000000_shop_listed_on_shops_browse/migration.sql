-- Creator opt-out: hide shop from public /shops browse and home “top shops” (storefront /s/{slug} still works).
ALTER TABLE "Shop" ADD COLUMN "listedOnShopsBrowse" BOOLEAN NOT NULL DEFAULT true;
