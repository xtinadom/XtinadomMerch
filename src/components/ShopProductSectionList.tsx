import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import type { ShopSectionRow } from "@/lib/shop-browse-sections";

type Props = {
  sections: ShopSectionRow[];
  /** Return null to hide “View all” (e.g. untagged bucket). */
  viewAllHrefForTag: (slug: string) => string | null;
  emptyMessage: string;
  /** Max cards per section (default 6). Pass `Infinity` to list every product in that section. */
  limitPerSection?: number;
};

export function ShopProductSectionList({
  sections,
  viewAllHrefForTag,
  emptyMessage,
  limitPerSection = 6,
}: Props) {
  const cap = limitPerSection;
  if (sections.length === 0) {
    return <p className="mt-8 text-sm text-zinc-600">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-12">
      {sections.map(({ tag, products }) => {
        const viewAll = tag.slug ? viewAllHrefForTag(tag.slug) : null;
        const shown =
          cap === Infinity ? products : products.slice(0, cap);
        return (
          <section key={tag.id}>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-medium text-zinc-200">{tag.name}</h2>
              {viewAll ? (
                <Link
                  href={viewAll}
                  className="text-xs text-blue-400/90 hover:underline"
                >
                  View all
                </Link>
              ) : tag.slug === "" ? (
                <span className="text-xs text-zinc-600">Tag in admin to group these</span>
              ) : null}
            </div>
            <ul className="grid justify-center gap-3 [grid-template-columns:repeat(auto-fill,175px)] sm:justify-start">
              {shown.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
