import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  PERSONA_COOKIE,
  DOMME_COLLECTION_SLUGS,
  dommeCollectionSortIndex,
  isPersona,
} from "@/lib/constants";
import { ProductCard } from "@/components/ProductCard";
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const jar = await cookies();
  const personaRaw = jar.get(PERSONA_COOKIE)?.value;
  const persona = isPersona(personaRaw) ? personaRaw : null;

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { active: true },
        orderBy: { name: "asc" },
        include: { category: true },
      },
    },
  });

  const subFirstSlugs = ["photo-printed", "used"];

  const ordered =
    persona === "domme"
      ? [...categories].sort((a, b) => {
          const ad = dommeCollectionSortIndex(a.slug);
          const bd = dommeCollectionSortIndex(b.slug);
          if (ad !== bd) return ad - bd;
          return a.sortOrder - b.sortOrder;
        })
      : persona === "sub"
        ? [...categories].sort((a, b) => {
            const ai = subFirstSlugs.indexOf(a.slug);
            const bi = subFirstSlugs.indexOf(b.slug);
            const as = ai === -1 ? 99 : ai;
            const bs = bi === -1 ? 99 : bi;
            return as - bs || a.sortOrder - b.sortOrder;
          })
        : categories;

  const headline =
    persona === "domme"
      ? "Domme collection"
      : persona === "sub"
        ? "Sub shop — photo prints & used"
        : "Shop";

  const categoriesForShop =
    persona === "domme"
      ? ordered.filter((c) => DOMME_COLLECTION_SLUGS.has(c.slug))
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
