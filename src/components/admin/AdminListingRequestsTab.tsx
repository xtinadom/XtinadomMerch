import {
  adminApproveListingRequest,
  adminRejectListingRequest,
} from "@/actions/admin-marketplace";

type ListingRequestRow = {
  id: string;
  requestImages: unknown;
  shop: { displayName: string; slug: string };
  product: { id: string; name: string; slug: string };
};

type ProductOption = { id: string; name: string };

export function AdminListingRequestsTab(props: {
  rows: ListingRequestRow[];
  productOptions: ProductOption[];
}) {
  const { rows, productOptions } = props;

  return (
    <section aria-label="Listing requests">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Listing requests (submitted)
      </h2>
      <p className="mt-1 text-xs text-zinc-600">
        Approve only after the shop has paid the listing fee (unless it is the platform catalog shop).
      </p>
      <ul className="mt-4 space-y-4">
        {rows.map((r) => {
          const imgs = Array.isArray(r.requestImages) ? (r.requestImages as string[]) : [];
          return (
            <li key={r.id} className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-300">
              <p>
                <span className="font-medium">{r.shop.displayName}</span>{" "}
                <span className="font-mono text-xs text-zinc-500">/s/{r.shop.slug}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Current catalog item: {r.product.name} ({r.product.slug})
              </p>
              {imgs.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-xs text-zinc-500">
                  {imgs.map((u, i) => (
                    <li key={i} className="break-all">
                      {u}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-zinc-600">No image URLs submitted.</p>
              )}
              <form action={adminApproveListingRequest} className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-4">
                <input type="hidden" name="listingId" value={r.id} />
                <label className="text-xs text-zinc-500">
                  Approve as product
                  <select
                    name="productId"
                    required
                    defaultValue={r.product.id}
                    className="ml-1 block max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
                  >
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded bg-emerald-900/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-900/60"
                >
                  Approve
                </button>
              </form>
              <form action={adminRejectListingRequest} className="mt-2">
                <input type="hidden" name="listingId" value={r.id} />
                <button
                  type="submit"
                  className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500"
                >
                  Reject
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No submitted listing requests.</p>
      ) : null}
    </section>
  );
}
