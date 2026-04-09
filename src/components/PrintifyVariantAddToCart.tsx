"use client";

import { useMemo, useState } from "react";
import { addToCart } from "@/actions/cart";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import { uniqueImageUrlsOrdered } from "@/lib/product-media";

export type PrintifyVariantOption = {
  id: string;
  title: string;
  priceCents: number;
  imageUrl: string | null;
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

type Props = {
  productId: string;
  variants: PrintifyVariantOption[];
  galleryExtras: string[];
};

export function PrintifyVariantAddToCart({
  productId,
  variants,
  galleryExtras,
}: Props) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const selected = useMemo(
    () => variants.find((v) => v.id === variantId) ?? variants[0],
    [variants, variantId],
  );

  const heroSrc = selected?.imageUrl?.trim() || null;
  /** Admin gallery first, then variant image (deduped). Avoids hiding extras when the variant URL matches mockups. */
  const allImages = useMemo(() => {
    const parts = [...galleryExtras];
    if (heroSrc) parts.push(heroSrc);
    return uniqueImageUrlsOrdered(parts);
  }, [galleryExtras, heroSrc]);

  if (!selected) return null;

  return (
    <div className="mx-auto w-full max-w-[400px]">
      <ProductImageGallery images={allImages} resetKey={variantId} />

      <label className="mt-4 block text-xs font-medium text-zinc-400">
        Option
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} — {formatPrice(v.priceCents)}
            </option>
          ))}
        </select>
      </label>

      <form
        action={async (fd) => {
          const vid = String(fd.get("variantId") ?? "").trim();
          await addToCart(productId, 1, vid);
        }}
        className="mt-4 w-full"
      >
        <input type="hidden" name="variantId" value={variantId} />
        <button
          type="submit"
          className="w-full rounded-xl bg-rose-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-rose-600"
        >
          Add to cart
        </button>
      </form>
    </div>
  );
}
