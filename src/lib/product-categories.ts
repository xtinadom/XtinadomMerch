export type ProductWithExtraCategories = {
  categoryId: string;
  extraCategories?: { categoryId: string }[];
};

/** Primary first, then extra placements (deduped). */
export function productCategoryIds(p: ProductWithExtraCategories): string[] {
  const extra = p.extraCategories?.map((e) => e.categoryId) ?? [];
  const out: string[] = [p.categoryId];
  for (const id of extra) {
    if (id !== p.categoryId && !out.includes(id)) out.push(id);
  }
  return out;
}

export function productListedInCategory(
  p: ProductWithExtraCategories,
  categoryId: string,
): boolean {
  if (p.categoryId === categoryId) return true;
  return p.extraCategories?.some((e) => e.categoryId === categoryId) ?? false;
}
