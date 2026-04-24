"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminUpdateShopHomeRanking } from "@/actions/admin-shop-home-top";
import { sortShopsForBrowse } from "@/lib/shops-browse";

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type AdminShopHomeTopRow = {
  id: string;
  slug: string;
  displayName: string;
  active: boolean;
  totalSalesCents: number;
  editorialPriority: number | null;
  editorialPinnedUntil: string | null;
  createdAt: string;
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function ShopRankRow(props: { row: AdminShopHomeTopRow }) {
  const { row } = props;
  const router = useRouter();
  const [state, formAction] = useActionState(adminUpdateShopHomeRanking, { ok: false, error: null });

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const pinnedValue =
    row.editorialPinnedUntil != null && row.editorialPinnedUntil !== ""
      ? toDatetimeLocalValue(new Date(row.editorialPinnedUntil))
      : "";

  return (
    <tr className="border-b border-zinc-900 align-top text-xs text-zinc-300">
      <td className="py-2 pr-2">
        <Link href={`/s/${encodeURIComponent(row.slug)}`} className="font-medium text-blue-400/90 hover:underline">
          {row.displayName}
        </Link>
        <div className="mt-0.5 font-mono text-[10px] text-zinc-600">/s/{row.slug}</div>
        {!row.active ? (
          <span className="mt-1 inline-block rounded bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-200/90">
            inactive
          </span>
        ) : null}
      </td>
      <td className="py-2 pr-2 tabular-nums text-zinc-500">{formatUsd(row.totalSalesCents)}</td>
      <td className="py-2 pr-2">
        <form action={formAction} className="flex flex-col gap-1.5">
          <input type="hidden" name="shopId" value={row.id} />
          <label className="block text-[10px] uppercase tracking-wide text-zinc-600">
            Priority
            <input
              name="editorialPriority"
              type="number"
              defaultValue={row.editorialPriority ?? ""}
              placeholder="—"
              className="mt-0.5 block w-full min-w-[5rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-200"
            />
          </label>
          <label className="block text-[10px] uppercase tracking-wide text-zinc-600">
            Pinned until (UTC)
            <input
              name="editorialPinnedUntil"
              type="datetime-local"
              defaultValue={pinnedValue}
              className="mt-0.5 block w-full min-w-[10rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-200"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
          >
            Save
          </button>
        </form>
        {state.error ? <p className="mt-1 text-[11px] text-amber-300/90">{state.error}</p> : null}
        {state.ok ? <p className="mt-1 text-[11px] text-emerald-400/90">Saved.</p> : null}
      </td>
    </tr>
  );
}

export function AdminShopHomeTopTab(props: { rows: AdminShopHomeTopRow[] }) {
  const { rows } = props;

  const previewRows = sortShopsForBrowse(
    rows
      .filter((r) => r.active)
      .map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt),
        editorialPinnedUntil: r.editorialPinnedUntil ? new Date(r.editorialPinnedUntil) : null,
      })),
    "editorial",
  ).slice(0, 10);

  return (
    <section aria-label="Home top shops ranking">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Home — Top shops</h2>
      <p className="mt-1 max-w-3xl text-xs text-zinc-600">
        The homepage shows up to 10 active creator shops using the same order as{" "}
        <Link href="/shops" className="text-blue-400/90 hover:underline">
          /shops
        </Link>{" "}
        (editorial default): <strong className="font-medium text-zinc-500">pinned until</strong>, then{" "}
        <strong className="font-medium text-zinc-500">editorial priority</strong> (higher first), then{" "}
        <strong className="font-medium text-zinc-500">total sales</strong>. Higher priority here doubles as a future
        hook for paid placement.
      </p>

      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Current home preview (active)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-zinc-400">
          {previewRows.length === 0 ? <li className="text-zinc-600">No active creator shops.</li> : null}
          {previewRows.map((r) => (
            <li key={r.id}>
              <span className="text-zinc-200">{r.displayName}</span>
              <span className="ml-2 font-mono text-[10px] text-zinc-600">/s/{r.slug}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-2 pr-2 font-medium">Shop</th>
              <th className="py-2 pr-2 font-medium">Sales (cached)</th>
              <th className="py-2 font-medium">Ranking</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ShopRankRow key={r.id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="mt-4 text-sm text-zinc-600">No creator shops yet.</p> : null}
    </section>
  );
}
