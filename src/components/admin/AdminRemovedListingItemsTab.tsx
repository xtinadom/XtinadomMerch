import {
  adminDeleteListingRemovalRecord,
  adminUpdateListingRemovalNotes,
} from "@/actions/admin-marketplace";
import { FulfillmentType } from "@/generated/prisma/enums";

export type RemovedListingRow = {
  id: string;
  requestItemName: string | null;
  /** ISO timestamp when removed from the requests queue (null only if data is inconsistent). */
  removedFromListingRequestsAt: string | null;
  adminListingRemovalNotes: string | null;
  shop: { displayName: string; slug: string };
  product: { id: string; name: string; slug: string; fulfillmentType: FulfillmentType };
};

function formatRemovedWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function AdminRemovedListingItemsTab(props: { rows: RemovedListingRow[] }) {
  const { rows } = props;

  return (
    <section aria-label="Removed listing queue items">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Removed items</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Rows you removed from <span className="text-zinc-500">Listing requests</span>. Live listings were taken off the
        creator&apos;s shop unless they were already frozen. Pipeline requests were rejected for the creator. Use{" "}
        <span className="text-zinc-500">delete</span> to clear the row from here and from Shop watch (same as Shop watch;
        does not delete the listing record; approved rows can show again under Requests). Rejected listings without
        removal timestamps reset to draft so they leave Shop watch history.
      </p>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No removed items yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm text-zinc-300">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2.5">Shop</th>
                <th className="px-3 py-2.5">Catalog item</th>
                <th className="whitespace-nowrap px-3 py-2.5">Removed</th>
                <th className="min-w-[18rem] px-3 py-2.5">Notes</th>
                <th className="whitespace-nowrap px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/90">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-3">
                    <span className="font-medium text-zinc-200">{r.shop.displayName}</span>
                    <br />
                    <span className="font-mono text-[11px] text-zinc-500">/s/{r.shop.slug}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-zinc-200">{r.product.name}</span>
                    <span className="mt-0.5 block text-[11px] text-zinc-500">{r.product.slug}</span>
                    {r.requestItemName?.trim() ? (
                      <span className="mt-1 block text-xs text-zinc-400">
                        Creator name: {r.requestItemName.trim()}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-zinc-400">
                    {r.removedFromListingRequestsAt
                      ? formatRemovedWhen(r.removedFromListingRequestsAt)
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <form action={adminUpdateListingRemovalNotes} className="space-y-2">
                      <input type="hidden" name="listingId" value={r.id} />
                      <label className="sr-only" htmlFor={`removal-notes-${r.id}`}>
                        Notes for {r.product.name}
                      </label>
                      <textarea
                        id={`removal-notes-${r.id}`}
                        name="adminListingRemovalNotes"
                        rows={3}
                        defaultValue={r.adminListingRemovalNotes ?? ""}
                        placeholder="Internal notes…"
                        className="w-full resize-y rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
                      />
                      <button
                        type="submit"
                        className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                      >
                        Save notes
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <form action={adminDeleteListingRemovalRecord}>
                      <input type="hidden" name="listingId" value={r.id} />
                      <button
                        type="submit"
                        title="Clears removal audit (freeze, creator remove, queue timestamps, notes). Rejected-only rows also reset to draft. Does not delete the listing record."
                        className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900"
                      >
                        delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
