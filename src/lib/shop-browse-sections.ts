import type { Tag } from "@/generated/prisma/client";
import { productHasTag } from "@/lib/product-tags";
import type { ProductCardProduct } from "@/components/ProductCard";

export type ShopSectionRow = {
  tag: { id: string; name: string; slug: string; sortOrder?: number };
  products: ProductCardProduct[];
};

/** Group active products by store tags; append “Other” for items with no ProductTag rows. */
export function buildShopSections(
  allProducts: ProductCardProduct[],
  tags: Tag[],
): ShopSectionRow[] {
  const taggedSections = tags
    .map((tag) => ({
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        sortOrder: tag.sortOrder,
      },
      products: allProducts.filter((p) => productHasTag(p, tag.id)),
    }))
    .filter((s) => s.products.length > 0);

  const untagged = allProducts.filter((p) => p.tags.length === 0);
  if (untagged.length === 0) return taggedSections;
  return [
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
  ];
}
