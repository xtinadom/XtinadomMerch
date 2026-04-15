<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Prisma

When a task adds or changes `prisma/schema.prisma` and includes new or updated files under `prisma/migrations/`, run **`npx prisma migrate deploy`** after those changes (with a valid `DATABASE_URL` / `POSTGRES_PRISMA_URL`). Run **`npx prisma generate`** when the schema or client output changes. Bump `PRISMA_SINGLETON_STAMP` in `src/lib/prisma.ts` if the generated client shape changes so dev does not keep a stale singleton.

## Shop listings vs Printify variants

- **`ShopListing`** is one sellable row per `(shopId, productId)` (`@@unique([shopId, productId])`): a single listing in the shop for that catalog / Printify product.
- **`Product.printifyVariants`** (JSON from Printify) holds option metadata (variant ids, titles, catalog prices). Options such as size are **not** separate `ShopListing` rows.
- **Per-option shop prices** for multi-variant Printify listings live on **`ShopListing.listingPrintifyVariantPrices`** (JSON: Printify variant id → cents). Dashboard and cart use `src/lib/listing-cart-price.ts` (`listingCartUnitCents`, `printifyVariantShopPriceCentsByIdForListing`).
- **`listingPrintifyVariantId`** is the admin-recorded default Printify variant (hero image sync, approval flow). If **`Product.printifyVariants`** has more than one option, the dashboard still uses **per-variant** pricing (`listingPrintifyVariantPrices`); checkout uses the variant the buyer selects. For a true single-variant product (`getPrintifyVariantsForProduct` length ≤ 1), the dashboard uses one **`priceCents`** field.
