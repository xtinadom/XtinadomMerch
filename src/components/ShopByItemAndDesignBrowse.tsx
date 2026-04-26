import { ShopProductSectionList } from "@/components/ShopProductSectionList";
import type { ShopSectionRow } from "@/lib/shop-browse-sections";

type Props = {
  byItemSections: ShopSectionRow[];
  byDesignSections: ShopSectionRow[];
  /** “View all” for By Item rows (tag slug). Design rows ignore this. */
  viewAllHrefForTag: (slug: string) => string | null;
  emptyMessage: string;
  shopSlug?: string;
  /** Default 1 (one card preview). Use `Infinity` to list every product in each section. */
  limitPerSection?: number;
};

export function ShopByItemAndDesignBrowse({
  byItemSections,
  byDesignSections,
  viewAllHrefForTag,
  emptyMessage,
  shopSlug,
  limitPerSection = 1,
}: Props) {
  const emptyItem = byItemSections.length === 0;
  const emptyDesign = byDesignSections.length === 0;
  if (emptyItem && emptyDesign) {
    return <p className="mt-8 text-sm text-zinc-600">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-16">
      {!emptyItem ? (
        <div>
          <ShopProductSectionList
            shopSlug={shopSlug}
            sections={byItemSections}
            viewAllHrefForTag={viewAllHrefForTag}
            emptyMessage=""
            limitPerSection={limitPerSection}
            layout="wrap"
          />
        </div>
      ) : null}

      {!emptyDesign ? (
        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
            By Design
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            One product per design name (from listing design labels).
          </p>
          <div className="mt-6">
            <ShopProductSectionList
              shopSlug={shopSlug}
              sections={byDesignSections}
              viewAllHrefForTag={() => null}
              emptyMessage=""
              limitPerSection={limitPerSection}
              layout="wrap"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
