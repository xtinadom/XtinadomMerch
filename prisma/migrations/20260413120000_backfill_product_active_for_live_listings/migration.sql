-- Storefront queries filter on product.active; baseline stub products start inactive while the shop listing can be live.
UPDATE "Product" AS p
SET "active" = true
FROM "ShopListing" AS sl
WHERE sl."productId" = p.id
  AND sl."active" = true
  AND p."active" = false;
