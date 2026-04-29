<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Prisma

When a task adds or changes `prisma/schema.prisma` and includes new or updated files under `prisma/migrations/`, run **`npx prisma migrate deploy`** after those changes **only if the user approved applying migrations to that database** (with a valid `DATABASE_URL` / `POSTGRES_PRISMA_URL`; see **Database safety (agents)** below). Run **`npx prisma generate`** when the schema or client output changes. Bump `PRISMA_SINGLETON_STAMP` in `src/lib/prisma.ts` if the generated client shape changes so dev does not keep a stale singleton.

## Database safety (agents)

AI agents **must not** perform destructive or data-mutating database operations in **any** environment (local, staging, production) unless the **human explicitly approved that exact operation in the same conversation** (for example: “yes, run `prisma migrate deploy` against production,” or “yes, delete those rows”).

**Forbidden without that explicit approval** (non-exhaustive):

- `prisma migrate reset`, or any command that drops or recreates schemas or wipes data
- `prisma db push` when it could drop columns/tables or otherwise destroy data
- `npm run db:seed`, `prisma db seed`, or other scripts that overwrite or bulk-insert production-like data
- Raw SQL or Prisma calls that **delete, truncate, drop**, or bulk-update rows (`DELETE`, `TRUNCATE`, `DROP`, `$executeRaw` / `$executeRawUnsafe` aimed at mutation, “cleanup” scripts under `scripts/` that change rows, ad-hoc fixes via `psql`)

**Usually allowed without extra approval:**

- **Authoring** migration SQL or schema changes **as files in the repo** for human review (without applying them unless the user approved apply + target)
- **`npx prisma generate`** and read-only inspection of schema/code
- Normal application **read** code paths

If it is unclear whether the user authorized mutating a **real** database, **stop and ask** before running CLI commands, migrations, or scripts.

## Shop listings vs Printify variants

- **`ShopListing`** is one sellable row per `(shopId, productId)` (`@@unique([shopId, productId])`): a single listing in the shop for that catalog / Printify product.
- **`Product.printifyVariants`** (JSON from Printify) holds option metadata (variant ids, titles, catalog prices). Options such as size are **not** separate `ShopListing` rows.
- **Per-option shop prices** for multi-variant Printify listings live on **`ShopListing.listingPrintifyVariantPrices`** (JSON: Printify variant id → cents). Dashboard and cart use `src/lib/listing-cart-price.ts` (`listingCartUnitCents`, `printifyVariantShopPriceCentsByIdForListing`).
- **`listingPrintifyVariantId`** is the admin-recorded default Printify variant (hero image sync, approval flow). If **`Product.printifyVariants`** has more than one option, the dashboard still uses **per-variant** pricing (`listingPrintifyVariantPrices`); checkout uses the variant the buyer selects. For a true single-variant product (`getPrintifyVariantsForProduct` length ≤ 1), the dashboard uses one **`priceCents`** field.
