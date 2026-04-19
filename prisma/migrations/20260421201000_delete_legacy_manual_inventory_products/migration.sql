-- Purge legacy manually fulfilled products ("used" / stock-tracked items) after enum migration
-- 20260421190000 (all rows are fulfillmentType printify). Identifies them by inventory tracking +
-- missing Printify wiring, not by the removed enum value.
--
-- Preserves:
--   - Any product referenced by OrderLine (order history).
--   - Baseline listing stubs: inactive product + at least one ShopListing (draft pipeline).
--   - Anything with listingPrintifyProductId on a ShopListing (Printify-backed listing).
--
-- Targets:
--   - Seed slug sample-used-item (if still present).
--   - Active products that still look like manual inventory (trackInventory, no Printify ids, no
--     listing-level Printify id).

DELETE FROM "Product" p
WHERE NOT EXISTS (SELECT 1 FROM "OrderLine" ol WHERE ol."productId" = p.id)
  AND (
    p.slug = 'sample-used-item'
    OR (
      p."trackInventory" IS TRUE
      AND NULLIF(btrim(p."printifyProductId"), '') IS NULL
      AND NULLIF(btrim(p."printifyVariantId"), '') IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "ShopListing" sl
        WHERE sl."productId" = p.id
          AND NULLIF(btrim(sl."listingPrintifyProductId"), '') IS NOT NULL
      )
      AND (
        p."active" IS TRUE
        OR NOT EXISTS (SELECT 1 FROM "ShopListing" sl0 WHERE sl0."productId" = p.id)
      )
    )
  );
