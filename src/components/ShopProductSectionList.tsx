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
  /**
   * `stack` — full-width sections stacked vertically (classic shop).
   * `wrap` — each tag/design is a narrow column; columns flow in a horizontal row and wrap.
   */
  layout?: "stack" | "wrap";
};

export function ShopProductSectionList({
  sections,
  viewAllHrefForTag,
  emptyMessage,
  limitPerSection = 6,
  layout = "stack",
}: Props) {
  const cap = limitPerSection;
  if (sections.length === 0) {
    return <p className="mt-8 text-sm text-zinc-600">{emptyMessage}</p>;
  }

  if (layout === "wrap") {
    return (
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-10 sm:justify-start">
        {sections.map(({ tag, products }) => {
          const viewAll = tag.slug ? viewAllHrefForTag(tag.slug) : null;
          const shown =
            cap === Infinity ? products : products.slice(0, cap);
          return (
            <section
              key={tag.id}
              className="flex w-[175px] max-w-[min(100%,175px)] flex-none flex-col gap-2"
            >
              <div className="flex min-h-10 flex-col gap-1">
                <h2 className="line-clamp-3 text-left text-xs font-medium leading-snug text-zinc-200 sm:text-sm">
                  {tag.name}
                </h2>
                {viewAll ? (
                  <Link
                    href={viewAll}
                    className="w-fit text-[10px] text-blue-400/90 hover:underline sm:text-xs"
                  >
                    View all
                  </Link>
                ) : tag.slug === "" && tag.id === "__untagged__" ? (
                  <span className="text-[10px] leading-snug text-zinc-600 sm:text-xs">
                    Tag in admin to group these
                  </span>
                ) : null}
              </div>
              <ul className="flex flex-col gap-2">
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
