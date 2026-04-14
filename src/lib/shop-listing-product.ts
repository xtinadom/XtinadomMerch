import type { ProductCardProduct } from "@/components/ProductCard";

export function productCardProductFromListing<
  LP extends {
    priceCents: number;
    product: ProductCardProduct;
    requestItemName?: string | null;
  },
>(listing: LP): ProductCardProduct {
  const custom = listing.requestItemName?.trim();
  const name = custom || listing.product.name;
  return { ...listing.product, name, priceCents: listing.priceCents };
}
