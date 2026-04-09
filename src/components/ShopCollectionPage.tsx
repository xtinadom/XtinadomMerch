import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreTags } from "@/lib/store-tags";
import { CatalogGroup } from "@/generated/prisma/enums";
import { audienceWhereForCollection } from "@/lib/shop-queries";
import { buildShopSections } from "@/lib/shop-browse-sections";
import { ProductCard } from "@/components/ProductCard";
import { ShopProductSectionList } from "@/components/ShopProductSectionList";
import { DommeMerchWebsitePromo } from "@/components/DommeMerchWebsitePromo";
import {
  SHOP_ALL_ROUTE,
  SHOP_DOMME_ROUTE,
  SHOP_SUB_ROUTE,
} from "@/lib/constants";

const shopBase = (c: CatalogGroup) =>
  c === CatalogGroup.sub ? SHOP_SUB_ROUTE : SHOP_DOMME_ROUTE;

const productInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

export async function ShopCollectionPage({
  collection,
  tagSlug,
}: {
  collection: CatalogGroup;
  tagSlug?: string;
}) {
  const base = shopBase(collection);
  const tags = await getStoreTags();

  let activeTag: (typeof tags)[0] | null = null;
  if (tagSlug) {
    activeTag = tags.find((t) => t.slug === tagSlug) ?? null;
    if (!activeTag) notFound();
  }

  const audience = audienceWhereForCollection(collection);

  if (activeTag) {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        audience,
        tags: { some: { tagId: activeTag.id } },
      },
      orderBy: { name: "asc" },
      include: productInclude,
    });

    return (
      <div>
        <p className="text-xs text-zinc-500">
          <Link href={base} className="hover:text-blue-400/90">
            {collection === CatalogGroup.sub ? "Sub collection" : "Domme collection"}
          </Link>
          <span className="mx-1.5 text-zinc-600">/</span>
          <span className="text-zinc-400">{activeTag.name}</span>
        </p>
        <h1 className="store-dimension-page-title mt-2 text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
          {activeTag.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          <Link href={`/shop/tag/${activeTag.slug}`} className="text-blue-400/90 hover:underline">
            View this tag across all products
          </Link>
        </p>
        {products.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-600">No products with this tag in this collection yet.</p>
        ) : (
          <ul className="mt-8 grid justify-center gap-3 [grid-template-columns:repeat(auto-fill,175px)] sm:justify-start">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const allProducts = await prisma.product.findMany({
    where: { active: true, audience },
    orderBy: { name: "asc" },
    include: productInclude,
  });

  const sections = buildShopSections(allProducts, tags);

  const title =
    collection === CatalogGroup.sub ? "Sub collection" : "Domme collection";

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="store-dimension-page-title text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
            {title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Narrow by tag from the menu, or{" "}
            <Link href={SHOP_ALL_ROUTE} className="text-blue-400/90 hover:underline">
              view all products
            </Link>
            .{" "}
            <Link href="/" className="text-zinc-500 hover:text-blue-400/90">
              Home
            </Link>
          </p>
        </div>
      </div>

      <ShopProductSectionList
        sections={sections}
        viewAllHrefForTag={(slug) => `${base}/tag/${slug}`}
        emptyMessage="No products in this collection yet. Import or sync in admin, assign tags, or browse all products."
      />

      {collection === CatalogGroup.domme ? (
        <div className="mt-16 border-t border-zinc-800 pt-12">
          <DommeMerchWebsitePromo />
        </div>
      ) : null}
    </div>
  );
}
