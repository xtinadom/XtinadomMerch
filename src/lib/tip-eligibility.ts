import type { Category, Product } from "@/generated/prisma/client";

export function productEligibleForTip(
  product: Pick<Product, "categoryId"> & { category: Pick<Category, "slug"> },
): boolean {
  const slug = product.category.slug;
  return slug === "photo-printed" || slug === "used";
}

export function cartHasTipEligibleProduct(
  products: (Pick<Product, "categoryId"> & { category: Pick<Category, "slug"> })[],
): boolean {
  return products.some(productEligibleForTip);
}
