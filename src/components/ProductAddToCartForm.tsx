"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/actions/cart";

const ADDED_MS = 2200;

export function ProductAddToCartForm({
  productId,
  shopSlug,
}: {
  productId: string;
  /** When set, resolves the listing in this shop (required for non-platform shops). */
  shopSlug?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <form
      className="mt-4 w-full"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await addToCart(productId, 1, undefined, shopSlug ?? undefined);
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
  );
}
