"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/actions/cart";
import { ProductImageGallery, PRODUCT_HERO_GALLERY_WRAP_CLASS } from "@/components/ProductImageGallery";
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

const ADDED_MS = 2200;

type Props = {
  productId: string;
  variants: PrintifyVariantOption[];
  galleryExtras: string[];
  shopSlug?: string;
};

export function PrintifyVariantAddToCart({
  productId,
  variants,
  galleryExtras,
  shopSlug,
}: Props) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    setAdded(false);
  }, [variantId]);

  const selected = useMemo(
    () => variants.find((v) => v.id === variantId) ?? variants[0],
    [variants, variantId],
  );

  /** Listing storefront selection is already applied in `galleryExtras`; do not append variant mockups or excluded URLs reappear. */
  const galleryImages = useMemo(
    () => uniqueImageUrlsOrdered([...galleryExtras]),
    [galleryExtras],
  );
  const heroSrc = selected?.imageUrl?.trim() || null;

  if (!selected) return null;

  return (
    <div className={PRODUCT_HERO_GALLERY_WRAP_CLASS}>
      <ProductImageGallery
        images={galleryImages}
        resetKey={variantId}
        preferMainSrc={heroSrc}
      />

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
        className="mt-4 w-full"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await addToCart(productId, 1, variantId, shopSlug ?? undefined);
            if (!r.ok) return;
            router.refresh();
            setAdded(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setAdded(false), ADDED_MS);
          });
        }}
      >
        <span className="sr-only" role="status" aria-live="polite">
          {added ? "Added to cart" : ""}
        </span>
        <button
          type="submit"
          disabled={pending}
          className={`w-full rounded-xl px-6 py-3 text-sm font-medium transition disabled:opacity-70 ${
            added
              ? "bg-zinc-400 text-zinc-950 hover:bg-zinc-300"
              : "bg-blue-900 text-white hover:bg-blue-800"
          }`}
        >
          {pending ? "Adding…" : added ? "Added to cart" : "Add to cart"}
        </button>
      </form>
    </div>
  );
}
