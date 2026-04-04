import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { PERSONA_COOKIE, dommeCollectionSortIndex, isPersona } from "@/lib/constants";
import { categoryInDommeBranch } from "@/lib/category-tree";
import { productListedInCategory } from "@/lib/product-categories";
import { ProductCard } from "@/components/ProductCard";
import type { Category, Product } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type ListedProduct = Product & {
  category: Category;
  extraCategories: { categoryId: string }[];
};

export default async function ShopPage() {
  const jar = await cookies();
  const personaRaw = jar.get(PERSONA_COOKIE)?.value;
  const persona = isPersona(personaRaw) ? personaRaw : null;

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const categoryIds = categories.map((c) => c.id);

  const allProducts = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { categoryId: { in: categoryIds } },
        { extraCategories: { some: { categoryId: { in: categoryIds } } } },
      ],
    },
    orderBy: { name: "asc" },
    include: { category: true, extraCategories: true },
  });

  const productsByCategoryId = new Map<string, ListedProduct[]>();
  for (const id of categoryIds) productsByCategoryId.set(id, []);

  for (const p of allProducts) {
    for (const cid of categoryIds) {
      if (productListedInCategory(p, cid)) {
        productsByCategoryId.get(cid)!.push(p);
      }
    }
  }

  for (const [cid, list] of productsByCategoryId) {
    const seen = new Set<string>();
    productsByCategoryId.set(
      cid,
      list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))),
    );
  }

  const categoriesWithProducts = categories.map((c) => ({
    ...c,
    products: productsByCategoryId.get(c.id) ?? [],
  }));

  const categoryById = new Map(
    categoriesWithProducts.map((c) => [
      c.id,
      {
        id: c.id,
        slug: c.slug,
        name: c.name,
        parentId: c.parentId,
        sortOrder: c.sortOrder,
        catalogGroup: c.catalogGroup,
      },
    ]),
  );

  const subFirstSlugs = ["photo-printed", "used"];

  const ordered =
    persona === "domme"
      ? [...categoriesWithProducts].sort((a, b) => {
          const ad = dommeCollectionSortIndex(a.slug);
          const bd = dommeCollectionSortIndex(b.slug);
          if (ad !== bd) return ad - bd;
          return a.sortOrder - b.sortOrder;
        })
      : persona === "sub"
        ? [...categoriesWithProducts].sort((a, b) => {
            const ai = subFirstSlugs.indexOf(a.slug);
            const bi = subFirstSlugs.indexOf(b.slug);
            const as = ai === -1 ? 99 : ai;
            const bs = bi === -1 ? 99 : bi;
            return as - bs || a.sortOrder - b.sortOrder;
          })
        : categoriesWithProducts;

  const headline =
    persona === "domme"
      ? "Domme collection"
      : persona === "sub"
        ? "Sub shop — photo prints & used"
        : "Shop";

  const categoriesForShop =
    persona === "domme"
      ? ordered.filter((c) => categoryInDommeBranch(c.id, categoryById))
      : ordered;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">{headline}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {persona === "domme"
              ? "Other categories (photo prints, used items) are in the Categories menu above."
              : "All categories are in the menu above."}{" "}
            <Link href="/" className="text-rose-400/90 hover:underline">
              Change persona
            </Link>
          </p>
        </div>
      </div>

      <div className="space-y-12">
        {categoriesForShop.map((cat) => (
          <section key={cat.id}>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-medium text-zinc-200">{cat.name}</h2>
              <Link
                href={`/category/${cat.slug}`}
                className="text-xs text-rose-400/90 hover:underline"
              >
                View all
              </Link>
            </div>
            {cat.description && (
              <p className="mb-4 text-sm text-zinc-500">{cat.description}</p>
            )}
            {cat.products.length === 0 ? (
              cat.slug === "domme-website-services" ? (
                <p className="text-sm text-zinc-500">
                  Merch storefront service —{" "}
                  <Link
                    href="/category/domme-website-services"
                    className="text-rose-400/90 hover:underline"
                  >
                    view details &amp; request a quote
                  </Link>
                  .
                </p>
              ) : (
                <p className="text-sm text-zinc-600">No products yet.</p>
              )
            ) : (
              <ul className="grid justify-center gap-3 [grid-template-columns:repeat(auto-fill,175px)] sm:justify-start">
                {cat.products.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <ProductCard product={p} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
