import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/ProductCard";
import { DommeMerchWebsitePromo } from "@/components/DommeMerchWebsitePromo";
import { Audience } from "@/generated/prisma/enums";
import { DOMME_COLLECTION_SLUGS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      products: {
        where: {
          active: true,
          ...(DOMME_COLLECTION_SLUGS.has(slug)
            ? { audience: { not: Audience.sub } }
            : {}),
        },
        orderBy: { name: "asc" },
        include: { category: true },
      },
    },
  });

  if (!category) notFound();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-50">{category.name}</h1>
      {category.description && (
        <p className="mt-2 text-sm text-zinc-500">{category.description}</p>
      )}
      {category.products.length > 0 ? (
        <ul className="mt-8 grid justify-center gap-3 [grid-template-columns:repeat(auto-fill,175px)] sm:justify-start">
          {category.products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      ) : slug === "domme-website-services" ? null : (
        <p className="mt-8 text-sm text-zinc-600">No products in this category.</p>
      )}
      {slug === "domme-website-services" && (
        <div className={category.products.length > 0 ? "mt-12" : "mt-8"}>
          <DommeMerchWebsitePromo />
        </div>
      )}
    </div>
  );
}
