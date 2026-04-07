import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreTags } from "@/lib/store-tags";
import { ProductCard } from "@/components/ProductCard";
import { SHOP_ALL_ROUTE } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const productInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

export default async function ShopUniversalTagPage({ params }: Props) {
  const { slug } = await params;
  const tags = await getStoreTags();
  const activeTag = tags.find((t) => t.slug === slug) ?? null;
  if (!activeTag) notFound();

  const products = await prisma.product.findMany({
    where: {
      active: true,
      tags: { some: { tagId: activeTag.id } },
    },
    orderBy: { name: "asc" },
    include: productInclude,
  });

  return (
    <div>
      <p className="text-xs text-zinc-500">
        <Link href={SHOP_ALL_ROUTE} className="hover:text-rose-400/90">
          All products
        </Link>
        <span className="mx-1.5 text-zinc-600">/</span>
        <span className="text-zinc-400">{activeTag.name}</span>
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-50">{activeTag.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        All items with this tag (Sub collection, Domme collection, or both).
      </p>

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
