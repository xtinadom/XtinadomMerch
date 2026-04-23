-- Admin baseline catalog items can be tagged (many-to-many with Tag).

CREATE TABLE "AdminCatalogItemTag" (
    "adminCatalogItemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "AdminCatalogItemTag_pkey" PRIMARY KEY ("adminCatalogItemId","tagId")
);

ALTER TABLE "AdminCatalogItemTag" ADD CONSTRAINT "AdminCatalogItemTag_adminCatalogItemId_fkey" FOREIGN KEY ("adminCatalogItemId") REFERENCES "AdminCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminCatalogItemTag" ADD CONSTRAINT "AdminCatalogItemTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
