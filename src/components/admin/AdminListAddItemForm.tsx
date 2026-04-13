"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminAddCatalogItem } from "@/actions/admin-catalog-items";
import type { AdminCatalogVariantFormRow } from "@/lib/admin-catalog-item";
import {
  validateCatalogVariantFormRows,
  validateItemLevelWhenNoVariants,
} from "@/lib/admin-catalog-item";
import { AdminCatalogVariantRowsEditor } from "@/components/admin/AdminCatalogVariantRowsEditor";
import { AdminCatalogItemLevelFields } from "@/components/admin/AdminCatalogItemLevelFields";

export function AdminListAddItemForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [itemName, setItemName] = useState("");
  const [variants, setVariants] = useState<AdminCatalogVariantFormRow[]>([]);
  const [itemExampleListingUrl, setItemExampleListingUrl] = useState("");
  const [itemMinPriceDollars, setItemMinPriceDollars] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addVariantRow() {
    setVariants((v) => [
      ...v,
      { label: "", minPriceDollars: "", exampleListingUrl: "", platformProductId: "" },
    ]);
  }

  function removeVariantRow(index: number) {
    setVariants((v) => v.filter((_, i) => i !== index));
  }

  function updateVariant(index: number, patch: Partial<AdminCatalogVariantFormRow>) {
    setVariants((v) => v.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = itemName.trim();
    if (!name) {
      setError("Enter an item name.");
      return;
    }
    const checked = validateCatalogVariantFormRows(variants);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    if (checked.payload.length === 0) {
      const itemLevel = validateItemLevelWhenNoVariants(itemExampleListingUrl, itemMinPriceDollars);
      if (!itemLevel.ok) {
        setError(itemLevel.error);
        return;
      }
    }

    const fd = new FormData();
    fd.set("itemName", name);
    fd.set("variantsJson", JSON.stringify(checked.payload));
    fd.set("itemExampleListingUrl", itemExampleListingUrl);
    fd.set("itemMinPriceDollars", itemMinPriceDollars);

    startTransition(async () => {
      await adminAddCatalogItem(fd);
      setItemName("");
      setVariants([]);
      setItemExampleListingUrl("");
      setItemMinPriceDollars("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">List item</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Item name is required. If the item has no variants, set a minimum price below (example listing optional).
        Otherwise add variant rows for sizes, colors, etc.
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

        <AdminCatalogVariantRowsEditor
          variants={variants}
          onAddRow={addVariantRow}
          onRemoveRow={removeVariantRow}
          onChangeRow={updateVariant}
        />

        {variants.length === 0 ? (
          <AdminCatalogItemLevelFields
            exampleListingUrl={itemExampleListingUrl}
            minPriceDollars={itemMinPriceDollars}
            onChangeExampleListingUrl={setItemExampleListingUrl}
            onChangeMinPriceDollars={setItemMinPriceDollars}
          />
        ) : null}

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
