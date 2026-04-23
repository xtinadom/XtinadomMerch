"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminAddCatalogItem } from "@/actions/admin-catalog-items";
import { validateItemLevelWhenNoVariants } from "@/lib/admin-catalog-item";
import { AdminCatalogItemLevelFields } from "@/components/admin/AdminCatalogItemLevelFields";

export function AdminListAddItemForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [itemName, setItemName] = useState("");
  const [itemExampleListingUrl, setItemExampleListingUrl] = useState("");
  const [itemMinPriceDollars, setItemMinPriceDollars] = useState("");
  const [itemGoodsServicesCostDollars, setItemGoodsServicesCostDollars] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = itemName.trim();
    if (!name) {
      setError("Enter an item name.");
      return;
    }
    const itemLevel = validateItemLevelWhenNoVariants(
      itemExampleListingUrl,
      itemMinPriceDollars,
      itemGoodsServicesCostDollars,
    );
    if (!itemLevel.ok) {
      setError(itemLevel.error);
      return;
    }

    const fd = new FormData();
    fd.set("itemName", name);
    fd.set("itemExampleListingUrl", itemExampleListingUrl);
    fd.set("itemMinPriceDollars", itemMinPriceDollars);
    fd.set("itemGoodsServicesCostDollars", itemGoodsServicesCostDollars);

    startTransition(async () => {
      await adminAddCatalogItem(fd);
      setItemName("");
      setItemExampleListingUrl("");
      setItemMinPriceDollars("");
      setItemGoodsServicesCostDollars("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">List item</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Item name and minimum list price are required. Example listing URL and goods/services cost are optional.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-xs text-zinc-500">
          Item name
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
            maxLength={300}
            className="mt-1 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            placeholder="e.g. Ceramic mug"
          />
        </label>

        <AdminCatalogItemLevelFields
          exampleListingUrl={itemExampleListingUrl}
          minPriceDollars={itemMinPriceDollars}
          goodsServicesCostDollars={itemGoodsServicesCostDollars}
          onChangeExampleListingUrl={setItemExampleListingUrl}
          onChangeMinPriceDollars={setItemMinPriceDollars}
          onChangeGoodsServicesCostDollars={setItemGoodsServicesCostDollars}
        />

        {error ? (
          <p className="text-xs text-amber-200/90" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save item"}
        </button>
      </form>
    </div>
  );
}
