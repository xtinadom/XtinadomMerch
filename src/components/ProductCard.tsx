import Link from "next/link";
import type { Product, Tag } from "@/generated/prisma/client";
import { productPrimaryImage } from "@/lib/product-media";
import { cardLabelTag } from "@/lib/product-tags";

export type ProductCardProduct = Product & {
  primaryTag: Tag | null;
  tags: { tagId: string; tag: Tag }[];
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ProductCard({ product }: { product: ProductCardProduct }) {
  const img = productPrimaryImage(product);
  const label = cardLabelTag({
    primaryTagId: product.primaryTagId,
    primaryTag: product.primaryTag,
    tags: product.tags,
  });
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block w-full max-w-[175px] rounded-md border border-zinc-800 bg-zinc-900/50 p-1.5 transition hover:border-zinc-600 hover:bg-zinc-900"
    >
      <div className="mb-1.5 aspect-square w-full overflow-hidden rounded bg-zinc-800">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full min-h-[72px] items-center justify-center text-[9px] text-zinc-600">
            No image
          </div>
        )}
      </div>
      <p className="text-[8px] uppercase tracking-wide text-zinc-500">
        {label?.name ?? "Product"}
      </p>
      <h2 className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-tight text-zinc-100">
        {product.name}
      </h2>
      <p className="mt-1 text-[10px] text-rose-300/90">{formatPrice(product.priceCents)}</p>
    </Link>
  );
}
