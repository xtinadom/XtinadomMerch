"use client";

import { useEffect, useState } from "react";

export type AdminFeaturedPickerShop = { id: string; displayName: string };

type ProductRow = { productId: string; label: string };

/**
 * Two-step picker: choose a creator shop, then choose a live catalog product from that shop only.
 */
export function AdminFeaturedProductPickerByShop(props: {
  shops: AdminFeaturedPickerShop[];
  productsByShopId: Record<string, ProductRow[]>;
  selectedProductIds: string[];
  maxSelectable: number;
  onAddProduct: (productId: string) => void;
}) {
  const { shops, productsByShopId, selectedProductIds, maxSelectable, onAddProduct } = props;
  const [shopId, setShopId] = useState(() => shops[0]?.id ?? "");

  useEffect(() => {
    if (shops.length === 0) {
      setShopId("");
      return;
    }
    if (!shopId || !shops.some((s) => s.id === shopId)) {
      setShopId(shops[0]!.id);
    }
  }, [shops, shopId]);

  const atLimit = selectedProductIds.length >= maxSelectable;
  const rows = shopId ? (productsByShopId[shopId] ?? []) : [];
  const available = rows.filter((r) => !selectedProductIds.includes(r.productId));

  return (
    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Shop</span>
        <select
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          value={shopId}
          onChange={(e) => setShopId(e.target.value)}
          disabled={shops.length === 0}
        >
          {shops.length === 0 ? <option value="">No shops with live listings</option> : null}
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Item</span>
        <select
          key={`${shopId}-${selectedProductIds.length}`}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
          defaultValue=""
          disabled={atLimit || !shopId || available.length === 0}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            onAddProduct(v);
          }}
        >
          <option value="">
            {atLimit
              ? "Slot limit reached"
              : available.length === 0
                ? "No more items for this shop"
                : "Choose item to add…"}
          </option>
          {available.map((r) => (
            <option key={r.productId} value={r.productId}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
