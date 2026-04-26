import Link from "next/link";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export type AdminShopLeaderboardRow = {
  rank: number;
  displayName: string;
  slug: string;
  merchandiseCents: number;
  shopCutCents: number;
  platformProfitCents: number;
  paidLineCount: number;
};

export function AdminShopLeaderboardTab(props: {
  rows: AdminShopLeaderboardRow[];
  salesFromValue: string;
  salesToValue: string;
}) {
  const { rows, salesFromValue, salesToValue } = props;

  return (
    <section aria-label="Shop leaderboard">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Shop leaderboard</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Creator shops ranked by paid merchandise total (quantity × unit price). Shops with no paid merchandise in the
        range are omitted. Same paid-order scope as Platform sales (tips and shipping excluded).
      </p>
      <form
        method="get"
        className="mt-4 flex flex-wrap items-end gap-3 text-xs"
        action="/admin"
      >
        <input type="hidden" name="tab" value="shop-leaderboard" />
        <label className="text-zinc-500">
          From (ISO date)
          <input
            type="text"
            name="salesFrom"
            defaultValue={salesFromValue}
            placeholder="2026-01-01"
            className="ml-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-200"
          />
        </label>
        <label className="text-zinc-500">
          To (ISO date)
          <input
            type="text"
            name="salesTo"
            defaultValue={salesToValue}
            placeholder="2026-12-31"
            className="ml-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-200"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-800 px-3 py-1 text-zinc-200 hover:bg-zinc-700"
        >
          Filter
        </button>
        <Link href="/admin?tab=shop-leaderboard" className="text-zinc-500 hover:text-zinc-300">
          Clear dates
        </Link>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-2 px-2 text-center font-medium">#</th>
              <th className="py-2 pr-2 text-left font-medium">Shop</th>
              <th className="py-2 px-2 text-center font-medium">Merchandise</th>
              <th className="py-2 px-2 text-center font-medium">Shop cut</th>
              <th className="py-2 px-2 text-center font-medium whitespace-nowrap text-blue-400/90">
                Platform profit
              </th>
              <th
                className="py-2 px-2 text-center font-medium"
                title="Paid line items in this date range: one per cart line (not total units)."
              >
                Item Sales
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-b border-zinc-900 text-zinc-300">
                <td className="py-2 px-2 text-center tabular-nums text-zinc-500">{r.rank}</td>
                <td className="py-2 pr-2 text-left">
                  <Link href={`/s/${encodeURIComponent(r.slug)}`} className="text-blue-400/90 hover:underline">
                    {r.displayName}
                  </Link>
                  <span className="ml-2 font-mono text-[10px] text-zinc-600">/s/{r.slug}</span>
                </td>
                <td className="py-2 px-2 text-center tabular-nums">{formatPrice(r.merchandiseCents)}</td>
                <td className="py-2 px-2 text-center tabular-nums">{formatPrice(r.shopCutCents)}</td>
                <td className="py-2 px-2 text-center tabular-nums">{formatPrice(r.platformProfitCents)}</td>
                <td className="py-2 px-2 text-center tabular-nums text-zinc-400">{r.paidLineCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No shops with paid merchandise in this range.</p>
      ) : null}
    </section>
  );
}
