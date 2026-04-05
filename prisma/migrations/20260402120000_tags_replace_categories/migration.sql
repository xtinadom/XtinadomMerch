-- Replace category tree with Tag + ProductTag.

DROP TABLE IF EXISTS "ProductExtraCategory";

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_categoryId_fkey";

ALTER TABLE "Product" DROP COLUMN IF EXISTS "categoryId";

ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_parentId_fkey";

DROP TABLE IF EXISTS "Category";

CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "collection" "CatalogGroup" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_collection_slug_key" ON "Tag"("collection", "slug");

CREATE TABLE "ProductTag" (
    "productId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId")
);

ALTER TABLE "Product" ADD COLUMN "primaryTagId" TEXT;
ALTER TABLE "Product" ADD COLUMN "checkoutTipEligible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_primaryTagId_fkey" FOREIGN KEY ("primaryTagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
