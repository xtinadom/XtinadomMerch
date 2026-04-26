import { ProductCard } from "@/components/ProductCard";
import type { ProductCardProduct } from "@/components/ProductCard";

/** Flat marketplace grid — no per-tag or per-design sections. */
export function ShopPlatformBrowseGrid({ products }: { products: ProductCardProduct[] }) {
  if (products.length === 0) {
    return <p className="mt-8 text-sm text-zinc-600">No products yet.</p>;
  }
  return (
    <ul className="mx-auto flex max-w-full flex-wrap justify-center gap-3">
      {products.map((p) => (
        <li key={p.id} className="w-[175px] shrink-0">
          <ProductCard product={p} showShopName />
        </li>
      ))}
    </ul>
  );
}
