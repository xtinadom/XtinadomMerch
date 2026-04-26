import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import type { ShopSectionRow } from "@/lib/shop-browse-sections";

type Props = {
  sections: ShopSectionRow[];
  shopSlug?: string;
  /** Return null to hide “View all” (e.g. untagged bucket). */
  viewAllHrefForTag: (slug: string) => string | null;
  emptyMessage: string;
  /** Max cards per section (default 6). Pass `Infinity` to list every product in that section. */
  limitPerSection?: number;
  /**
   * `stack` — full-width sections, large title row, product grid.
   * `wrap` — full-width sections, compact title row, same product grid (used on All products browse).
   */
  layout?: "stack" | "wrap";
};

export function ShopProductSectionList({
  sections,
  shopSlug,
  viewAllHrefForTag,
  emptyMessage,
  limitPerSection = 6,
  layout = "stack",
}: Props) {
  const cap = limitPerSection;
  if (sections.length === 0) {
    return <p className="mt-8 text-sm text-zinc-600">{emptyMessage}</p>;
  }

  const productGridClass = "mx-auto flex max-w-full flex-wrap justify-center gap-3";
  const productGridItemClass = "w-[175px] shrink-0";

  if (layout === "wrap") {
    return (
      <div className="space-y-10">
        {sections.map(({ tag, products }) => {
          const viewAll = tag.slug ? viewAllHrefForTag(tag.slug) : null;
          const shown =
            cap === Infinity ? products : products.slice(0, cap);
          return (
            <section key={tag.id} className="w-full">
              <div className="mb-3 flex min-h-10 flex-wrap items-baseline justify-between gap-2">
                <h2 className="line-clamp-2 text-left text-xs font-medium leading-snug text-zinc-200 sm:text-sm">
                  {tag.name}
                </h2>
                {viewAll ? (
                  <Link
                    href={viewAll}
                    className="shrink-0 text-[10px] text-blue-400/90 hover:underline sm:text-xs"
                  >
                    View all
                  </Link>
                ) : tag.slug === "" && tag.id === "__untagged__" ? (
                  <span className="text-[10px] leading-snug text-zinc-600 sm:text-xs">
                    Tag in admin to group these
                  </span>
                ) : null}
              </div>
              <ul className={productGridClass}>
                {shown.map((p) => (
                  <li key={p.id} className={productGridItemClass}>
                    <ProductCard product={p} shopSlug={shopSlug} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
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
              ) : tag.slug === "" && tag.id === "__untagged__" ? (
                <span className="text-xs text-zinc-600">Tag in admin to group these</span>
              ) : null}
            </div>
            <ul className={productGridClass}>
              {shown.map((p) => (
                <li key={p.id} className={productGridItemClass}>
                  <ProductCard product={p} shopSlug={shopSlug} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
