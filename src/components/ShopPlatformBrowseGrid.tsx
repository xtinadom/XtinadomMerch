import type { ReactNode } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { ProductCardProduct } from "@/components/ProductCard";

/** Flat grid — no per-tag or per-design sections (marketplace or single-shop “flat” browse). */
export function ShopPlatformBrowseGrid({
  products,
  emptyState,
  shopSlug,
  showShopName = true,
}: {
  products: ProductCardProduct[];
  /** When there are no rows (overrides default “No products yet.”). */
  emptyState?: ReactNode;
  /** Creator storefront (`/s/…`); omit on marketplace aggregate rows. */
  shopSlug?: string;
  /** Marketplace cards show each listing’s shop; single-shop flat browse leaves this off. */
  showShopName?: boolean;
}) {
  if (products.length === 0) {
    return (
      emptyState ?? <p className="mt-8 text-sm text-zinc-600">No products yet.</p>
    );
  }
  return (
    <ul className="mx-auto flex max-w-full flex-wrap justify-center gap-3">
      {products.map((p) => (
        <li key={p.id} className="w-[175px] shrink-0">
          <ProductCard product={p} shopSlug={shopSlug} showShopName={showShopName} />
        </li>
      ))}
    </ul>
  );
}
