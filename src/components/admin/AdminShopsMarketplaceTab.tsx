import {
  adminAssignShopListing,
  adminSetProductMinPrice,
  adminUpdateShopSpotlight,
} from "@/actions/admin-marketplace";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

type ShopEditorial = {
  id: string;
  slug: string;
  displayName: string;
  totalSalesCents: number;
  editorialPriority: number | null;
  editorialPinnedUntil: Date | null;
  homeFeaturedListingId: string | null;
  listings: { id: string; active: boolean; product: { name: string } }[];
};

type ProductMinRow = {
  id: string;
  name: string;
  minPriceCents: number;
  priceCents: number;
};

type ProductOption = { id: string; name: string };

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminShopsMarketplaceTab(props: {
  shops: ShopEditorial[];
  products: ProductMinRow[];
  allProductsForAssign: ProductOption[];
}) {
  const { shops, products, allProductsForAssign } = props;

  return (
    <div className="space-y-10">
      <section aria-label="Assign catalog listing">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Assign catalog product to shop
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          Creates or resets a shop listing to <strong className="text-zinc-500">draft</strong> / inactive.
          Check “Waive listing fee” to mark the fee paid immediately (e.g. platform promos).
        </p>
        <form action={adminAssignShopListing} className="mt-4 flex flex-wrap items-end gap-3 text-sm">
          <label className="text-zinc-500">
            Shop
            <select
              name="shopId"
              required
              className="ml-1 block rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
            >
              <option value="">Select…</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.slug})
                </option>
              ))}
            </select>
          </label>
          <label className="text-zinc-500">
            Product
            <select
              name="productId"
              required
              className="ml-1 block max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
            >
              <option value="">Select…</option>
              {allProductsForAssign.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" name="waiveListingFee" className="rounded border-zinc-600" />
            Waive listing fee
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
          >
            Assign / reset listing
          </button>
        </form>
      </section>

      <section aria-label="Minimum prices">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Minimum list prices
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          Shops cannot price below this (cents). Use 0 to fall back to each product&apos;s catalog price.
        </p>
        <ul className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-zinc-300"
            >
              <span className="min-w-0 flex-1">{p.name}</span>
              <span className="text-xs text-zinc-600">catalog {formatPrice(p.priceCents)}</span>
              <form action={adminSetProductMinPrice} className="flex items-center gap-2 text-xs">
                <input type="hidden" name="productId" value={p.id} />
                <label className="text-zinc-500">
                  Min (cents)
                  <input
                    type="number"
                    name="minPriceCents"
                    min={0}
                    defaultValue={p.minPriceCents}
                    className="ml-1 w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700"
                >
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Shop editorial">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Shop spotlight &amp; editorial
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          Pinned shops sort above others on the browse page when sort is “Editorial &amp; sales”.
        </p>
        <ul className="mt-4 space-y-6">
          {shops.map((s) => (
            <li key={s.id} className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-300">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{s.displayName}</span>
                <span className="font-mono text-xs text-zinc-500">/s/{s.slug}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-600">
                Lifetime sales {formatPrice(s.totalSalesCents)}
              </p>
              <form action={adminUpdateShopSpotlight} className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                <input type="hidden" name="shopId" value={s.id} />
                <label className="block text-zinc-500 sm:col-span-2">
                  Home featured listing
                  <select
                    name="homeFeaturedListingId"
                    defaultValue={s.homeFeaturedListingId ?? "__none__"}
                    className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
                  >
                    <option value="__none__">None</option>
                    {s.listings.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.product.name}
                        {l.active ? "" : " (inactive)"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-zinc-500">
                  Editorial priority (higher first)
                  <input
                    type="number"
                    name="editorialPriority"
                    min={0}
                    max={9999}
                    defaultValue={s.editorialPriority ?? ""}
                    placeholder="empty = organic"
                    className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
                  />
                </label>
                <label className="text-zinc-500">
                  Pinned until (local datetime)
                  <input
                    type="datetime-local"
                    name="editorialPinnedUntil"
                    defaultValue={
                      s.editorialPinnedUntil
                        ? toDatetimeLocalValue(s.editorialPinnedUntil)
                        : ""
                    }
                    className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
                  >
                    Save shop editorial
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
