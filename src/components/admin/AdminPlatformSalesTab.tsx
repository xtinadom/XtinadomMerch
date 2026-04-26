import Link from "next/link";
import type { AdminPlatformSalesMergedLine } from "@/lib/admin-platform-sales-merged-lines";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Local calendar date for table display (e.g. `04-25-26`). */
function formatDateMMDDYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  return `${mm}-${dd}-${yy}`;
}

function escapeCsvCell(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function AdminPlatformSalesTab(props: {
  lines: AdminPlatformSalesMergedLine[];
  salesFromValue: string;
  salesToValue: string;
}) {
  const { lines, salesFromValue, salesToValue } = props;
  const csvBody = lines
    .map((l) => {
      const merch =
        l.kind === "listing_publication_fee"
          ? 0
          : l.unitPriceCents * l.quantity;
      const shopName = l.shop?.displayName ?? "";
      const shopSlug = l.shop?.slug ?? "";
      return [
        l.order.createdAt.toISOString(),
        l.order.id,
        l.productName,
        String(l.quantity),
        String(merch),
        String(l.goodsServicesCostCents),
        String(l.platformCutCents),
        String(l.shopCutCents),
        shopName,
        shopSlug,
      ]
        .map((c) => escapeCsvCell(c))
        .join(",");
    })
    .join("\n");
  const csv =
    "date,order_id,item,qty,merchandise_cents,goods_services_cents,platform_fee_cents,shop_cut_cents,shop_name,shop_slug\n" +
    csvBody;
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

  return (
    <section aria-label="Platform sales">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Platform sales (paid lines)
      </h2>
      <p className="mt-1 text-xs text-zinc-600">
        Paid storefront order lines (merchandise splits) plus listing publication fees (card / mock checkout).
        Tips and shipping are not included. Publication fees are platform revenue (no shop merchandise split).
      </p>
      <form
        method="get"
        className="mt-4 flex flex-wrap items-end gap-3 text-xs"
        action="/admin"
      >
        <input type="hidden" name="tab" value="sales" />
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
        <a
          href={csvHref}
          download="platform-sales-lines.csv"
          className="rounded border border-zinc-600 px-3 py-1 text-zinc-300 hover:border-zinc-400"
        >
          Download CSV
        </a>
        <Link href="/admin?tab=sales" className="text-zinc-500 hover:text-zinc-300">
          Clear dates
        </Link>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-2 pr-2 font-medium">Date</th>
              <th className="py-2 pr-2 font-medium">Item</th>
              <th className="py-2 pr-2 font-medium">Qty</th>
              <th className="py-2 pr-2 font-medium">Merch</th>
              <th className="py-2 pr-2 font-medium">G/S cost</th>
              <th className="py-2 pr-2 font-medium">Plat. fee</th>
              <th className="py-2 pr-2 font-medium">Shop</th>
              <th className="py-2 font-medium">Shop name</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const isPubFee = l.kind === "listing_publication_fee";
              const merch = isPubFee ? 0 : l.unitPriceCents * l.quantity;
              return (
                <tr key={l.id} className="border-b border-zinc-900 text-zinc-300">
                  <td className="py-2 pr-2 font-mono text-[10px] text-zinc-500">
                    {formatDateMMDDYY(l.order.createdAt)}
                  </td>
                  <td className="py-2 pr-2">{l.productName}</td>
                  <td className="py-2 pr-2 tabular-nums">{l.quantity}</td>
                  <td className="py-2 pr-2 tabular-nums">
                    {isPubFee ? "—" : formatPrice(merch)}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{formatPrice(l.goodsServicesCostCents)}</td>
                  <td className="py-2 pr-2 tabular-nums">{formatPrice(l.platformCutCents)}</td>
                  <td className="py-2 pr-2 tabular-nums">{formatPrice(l.shopCutCents)}</td>
                  <td className="py-2 text-zinc-400">{l.shop?.displayName ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No matching paid lines or publication fees.</p>
      ) : null}
    </section>
  );
}
