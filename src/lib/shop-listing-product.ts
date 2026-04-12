import type { ProductCardProduct } from "@/components/ProductCard";

export function productCardProductFromListing<LP extends { priceCents: number; product: ProductCardProduct }>(
  listing: LP,
): ProductCardProduct {
  return { ...listing.product, priceCents: listing.priceCents };
}
