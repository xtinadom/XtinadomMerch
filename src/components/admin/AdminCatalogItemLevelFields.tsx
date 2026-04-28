"use client";

export function AdminCatalogItemLevelFields({
  exampleListingUrl,
  minPriceDollars,
  goodsServicesCostDollars,
  storefrontDescription,
  onChangeExampleListingUrl,
  onChangeMinPriceDollars,
  onChangeGoodsServicesCostDollars,
  onChangeStorefrontDescription,
}: {
  exampleListingUrl: string;
  minPriceDollars: string;
  goodsServicesCostDollars: string;
  storefrontDescription: string;
  onChangeExampleListingUrl: (v: string) => void;
  onChangeMinPriceDollars: (v: string) => void;
  onChangeGoodsServicesCostDollars: (v: string) => void;
  onChangeStorefrontDescription: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded border border-zinc-800/80 bg-zinc-950/40 p-3">
      <label className="block min-w-0 text-[11px] text-zinc-500">
        Storefront description (optional)
        <textarea
          value={storefrontDescription}
          onChange={(e) => onChangeStorefrontDescription(e.target.value)}
          rows={4}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
          placeholder="Shown on the public product page when this item is linked to a product…"
        />
      </label>
      <label className="block min-w-0 text-[11px] text-zinc-500">
        Example listing (optional)
        <input
          type="text"
          value={exampleListingUrl}
          onChange={(e) => onChangeExampleListingUrl(e.target.value)}
          maxLength={2048}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200"
          placeholder="https://… or /path…"
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
      <label className="block max-w-[10rem] text-[11px] text-zinc-500">
        Goods/services cost (USD, optional)
        <input
          type="text"
          inputMode="decimal"
          value={goodsServicesCostDollars}
          onChange={(e) => onChangeGoodsServicesCostDollars(e.target.value)}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-sm text-zinc-100"
          placeholder="0.00"
        />
      </label>
    </div>
  );
}
