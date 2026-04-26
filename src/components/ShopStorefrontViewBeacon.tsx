"use client";

import { useEffect } from "react";

/** One POST per tab session when a creator storefront home loads (Strict Mode safe). */
export function ShopStorefrontViewBeacon({ shopSlug }: { shopSlug: string }) {
  useEffect(() => {
    if (!shopSlug || typeof window === "undefined") return;
    const key = `storefrontSv:${shopSlug}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void fetch("/api/shop-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopSlug }),
      keepalive: true,
    }).catch(() => {});
  }, [shopSlug]);
  return null;
}
