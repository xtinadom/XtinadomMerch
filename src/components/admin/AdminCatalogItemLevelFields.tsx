"use client";

import {
  AdminPrintifyProductSelect,
  type AdminPrintifyProductOption,
} from "@/components/admin/AdminPrintifyProductSelect";

export function AdminCatalogItemLevelFields({
  printifyProducts,
  platformProductId,
  exampleListingUrl,
  minPriceDollars,
  onChangePlatformProductId,
  onChangeExampleListingUrl,
  onChangeMinPriceDollars,
}: {
  printifyProducts: AdminPrintifyProductOption[];
  platformProductId: string;
  exampleListingUrl: string;
  minPriceDollars: string;
  onChangePlatformProductId: (v: string) => void;
  onChangeExampleListingUrl: (v: string) => void;
  onChangeMinPriceDollars: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded border border-zinc-800/80 bg-zinc-950/40 p-3">
      <p className="text-[11px] text-zinc-500">
        No variants: minimum price is required. Example listing and Printify link are optional — pick a product
        below so the shop catalog can list this row without an example URL.
      </p>
      <AdminPrintifyProductSelect
        products={printifyProducts}
        value={platformProductId}
        onChange={onChangePlatformProductId}
        label="Linked Printify product"
        hint="Optional. Puts this row in the shop “Product catalog” even if the example link is empty."
      />
      <label className="block min-w-0 text-[11px] text-zinc-500">
        Example product listing (optional)
        <input
          type="text"
          value={exampleListingUrl}
          onChange={(e) => onChangeExampleListingUrl(e.target.value)}
          maxLength={2048}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200"
          placeholder="https://… or /product/…"
        />
      </label>
      <label className="block max-w-[10rem] text-[11px] text-zinc-500">
        Min price (USD)
        <input
          type="text"
          inputMode="decimal"
          value={minPriceDollars}
          onChange={(e) => onChangeMinPriceDollars(e.target.value)}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-sm text-zinc-100"
          placeholder="0.00"
        />
      </label>
    </div>
  );
}
