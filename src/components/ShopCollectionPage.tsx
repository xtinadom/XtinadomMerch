import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreTags } from "@/lib/store-tags";
import { CatalogGroup } from "@/generated/prisma/enums";
import { audienceWhereForCollection } from "@/lib/shop-queries";
import { productHasTag } from "@/lib/product-tags";
import { ProductCard } from "@/components/ProductCard";
import { DommeMerchWebsitePromo } from "@/components/DommeMerchWebsitePromo";
import { SHOP_DOMME_ROUTE, SHOP_SUB_ROUTE } from "@/lib/constants";

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
          <Link href={base} className="hover:text-rose-400/90">
            {collection === CatalogGroup.sub ? "Sub shop" : "Domme shop"}
          </Link>
          <span className="mx-1.5 text-zinc-600">/</span>
          <span className="text-zinc-400">{activeTag.name}</span>
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-50">{activeTag.name}</h1>
        {products.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-600">No products with this tag yet.</p>
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

  const taggedSections = tags
    .map((tag) => ({
      tag,
      products: allProducts.filter((p) => productHasTag(p, tag.id)),
    }))
    .filter((s) => s.products.length > 0);

  const untagged = allProducts.filter((p) => p.tags.length === 0);
  const sections =
    untagged.length > 0
      ? [
          ...taggedSections,
          {
            tag: {
              id: "__untagged__",
              name: "Other products",
              slug: "",
              sortOrder: 999,
            },
            products: untagged,
          },
        ]
      : taggedSections;

  const title =
    collection === CatalogGroup.sub ? "Sub shop" : "Domme shop";

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Browse by tag from the menu above.{" "}
            <Link href="/" className="text-rose-400/90 hover:underline">
              All collections
            </Link>
          </p>
        </div>
      </div>

      <div className="space-y-12">
        {sections.map(({ tag, products }) => (
          <section key={tag.id}>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-medium text-zinc-200">{tag.name}</h2>
              {tag.slug ? (
                <Link
                  href={`${base}/tag/${tag.slug}`}
                  className="text-xs text-rose-400/90 hover:underline"
                >
                  View all
                </Link>
              ) : (
                <span className="text-xs text-zinc-600">Tag in admin to group these</span>
              )}
            </div>
            <ul className="grid justify-center gap-3 [grid-template-columns:repeat(auto-fill,175px)] sm:justify-start">
              {products.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {sections.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600">
          No products in this shop yet. Import or sync items in admin, and assign at least one tag
          so they appear under a category.
        </p>
      ) : null}

      {collection === CatalogGroup.domme ? (
        <div className="mt-16 border-t border-zinc-800 pt-12">
          <DommeMerchWebsitePromo />
        </div>
      ) : null}
    </div>
  );
}
