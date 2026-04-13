"use client";

import type { AdminCatalogVariantFormRow } from "@/lib/admin-catalog-item";

export function AdminCatalogVariantRowsEditor({
  variants,
  onAddRow,
  onRemoveRow,
  onChangeRow,
}: {
  variants: AdminCatalogVariantFormRow[];
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onChangeRow: (index: number, patch: Partial<AdminCatalogVariantFormRow>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-500">Variants (optional)</span>
        <button
          type="button"
          onClick={onAddRow}
          className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
        >
          + Add variant
        </button>
      </div>
      {variants.length === 0 ? (
        <p className="text-[11px] text-zinc-600">
          None — use the item-level fields below (min price required), or click Add variant when the item has
          options.
        </p>
      ) : null}
      {variants.map((row, index) => (
        <div
          key={index}
          className="grid gap-3 rounded border border-zinc-800/80 bg-zinc-950/40 p-3 sm:grid-cols-[1fr_7rem_1fr_auto]"
        >
          <label className="block min-w-0 text-[11px] text-zinc-500">
            Variant name
            <input
              type="text"
              value={row.label}
              onChange={(e) => onChangeRow(index, { label: e.target.value })}
              className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              placeholder="e.g. 11 oz / Black"
            />
          </label>
          <label className="block text-[11px] text-zinc-500">
            Min price (USD)
            <input
              type="text"
              inputMode="decimal"
              value={row.minPriceDollars}
              onChange={(e) => onChangeRow(index, { minPriceDollars: e.target.value })}
              className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-sm text-zinc-100"
              placeholder="0.00"
            />
          </label>
          <label className="block min-w-0 text-[11px] text-zinc-500 sm:col-span-1">
            Example listing (optional)
            <input
              type="text"
              value={row.exampleListingUrl}
              onChange={(e) => onChangeRow(index, { exampleListingUrl: e.target.value })}
              className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200"
              placeholder="https://… or /path…"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => onRemoveRow(index)}
              className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
