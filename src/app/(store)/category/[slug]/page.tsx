import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/ProductCard";
import { DommeMerchWebsitePromo } from "@/components/DommeMerchWebsitePromo";
import { Audience } from "@/generated/prisma/enums";
import type { CategoryNode } from "@/lib/category-tree";
import { categoryInDommeBranch } from "@/lib/category-tree";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  const [category, tree] = await Promise.all([
    prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.category.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        parentId: true,
        sortOrder: true,
        catalogGroup: true,
      },
    }),
  ]);

  if (!category) notFound();

  const byId = new Map<string, CategoryNode>(tree.map((c) => [c.id, c]));
  const dommeBranch = categoryInDommeBranch(category.id, byId);

  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { categoryId: category.id },
        { extraCategories: { some: { categoryId: category.id } } },
      ],
      ...(dommeBranch ? { audience: { not: Audience.sub } } : {}),
    },
    orderBy: { name: "asc" },
    include: { category: true },
  });

  return (
    <div>
      {category.parent ? (
        <p className="text-xs text-zinc-500">
          <Link
            href={`/category/${category.parent.slug}`}
            className="hover:text-rose-400/90"
          >
            {category.parent.name}
          </Link>
          <span className="mx-1.5 text-zinc-600">/</span>
          <span className="text-zinc-400">{category.name}</span>
        </p>
      ) : null}
      <h1 className={`text-2xl font-semibold text-zinc-50 ${category.parent ? "mt-2" : ""}`}>
        {category.name}
      </h1>
      {category.description && (
        <p className="mt-2 text-sm text-zinc-500">{category.description}</p>
      )}

      {category.children.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Subcategories
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {category.children.map((ch) => (
              <li key={ch.id}>
                <Link
                  href={`/category/${ch.slug}`}
                  className="inline-block rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 transition hover:border-rose-900/50 hover:text-rose-200/90"
                >
                  {ch.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {products.length > 0 ? (
        <ul className="mt-8 grid justify-center gap-3 [grid-template-columns:repeat(auto-fill,175px)] sm:justify-start">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      ) : slug === "domme-website-services" ? null : (
        <p className="mt-8 text-sm text-zinc-600">No products in this category.</p>
      )}
      {slug === "domme-website-services" && (
        <div className={products.length > 0 ? "mt-12" : "mt-8"}>
          <DommeMerchWebsitePromo />
        </div>
      )}
    </div>
  );
}
