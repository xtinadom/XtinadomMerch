import type { CSSProperties } from "react";
import Link from "next/link";
import type { Product, Category } from "@/generated/prisma/client";
import { productPrimaryImage } from "@/lib/product-media";

type P = Product & { category: Category };

export function FeaturedSpotlightCard({ product, index }: { product: P; index: number }) {
  const img = productPrimaryImage(product);
  return (
    <li className="list-none">
      <Link
        href={`/product/${product.slug}`}
        aria-label={product.name}
        className="group block w-[220px] max-w-[85vw] overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 ring-1 ring-zinc-800/80 transition hover:border-zinc-600"
      >
        <div
          className="featured-spotlight-shimmer relative aspect-square w-full bg-zinc-800"
          style={
            { "--shimmer-delay": `${index * 0.45}s` } as CSSProperties
          }
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
      </Link>
    </li>
  );
}
