import type { Product } from "@/generated/prisma/client";

export function cartHasTipEligibleProduct(products: Pick<Product, "checkoutTipEligible">[]): boolean {
  return products.some((p) => p.checkoutTipEligible);
}
