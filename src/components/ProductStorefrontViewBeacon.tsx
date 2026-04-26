"use client";

import { useEffect } from "react";

/** Fire-and-forget PDP view for ranking the home hot carousel (one POST per tab session; survives Strict Mode remount). */
export function ProductStorefrontViewBeacon({ productSlug }: { productSlug: string }) {
  useEffect(() => {
    if (!productSlug || typeof window === "undefined") return;
    const key = `storefrontPv:${productSlug}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void fetch("/api/product-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSlug }),
      keepalive: true,
    }).catch(() => {});
  }, [productSlug]);
  return null;
}
