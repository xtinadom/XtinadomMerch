import {
  categoryByIdMap,
  categoryTouchesSlugSet,
  type CategoryGraphNode,
} from "@/lib/category-tree";
import { TIP_ELIGIBLE_CATEGORY_SLUGS } from "@/lib/constants";
import {
  productCategoryIds,
  type ProductWithExtraCategories,
} from "@/lib/product-categories";

export function productEligibleForTip(
  product: ProductWithExtraCategories,
  byId: Map<string, CategoryGraphNode>,
): boolean {
  return productCategoryIds(product).some((id) =>
    categoryTouchesSlugSet(id, byId, TIP_ELIGIBLE_CATEGORY_SLUGS),
  );
}

export function cartHasTipEligibleProduct(
  products: ProductWithExtraCategories[],
  allCategories: CategoryGraphNode[],
): boolean {
  const byId = categoryByIdMap(allCategories);
  return products.some((p) => productEligibleForTip(p, byId));
}
