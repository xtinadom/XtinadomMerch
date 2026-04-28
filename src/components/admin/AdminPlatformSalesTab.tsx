import Link from "next/link";
import type {
  AdminPlatformSalesMergedLine,
  PlatformSalesYtdTotals,
} from "@/lib/admin-platform-sales-merged-lines";
import { AdminClearPlatformSalesForm } from "@/components/admin/AdminClearPlatformSalesForm";

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

function buildSalesTabHref(parts: {
  salesFrom?: string;
  salesTo?: string;
  salesKind?: string;
}): string {
  const u = new URLSearchParams();
  u.set("tab", "sales");
  if (parts.salesFrom?.trim()) u.set("salesFrom", parts.salesFrom.trim());
  if (parts.salesTo?.trim()) u.set("salesTo", parts.salesTo.trim());
  if (parts.salesKind && parts.salesKind !== "all") u.set("salesKind", parts.salesKind);
  const q = u.toString();
  return `/admin?${q}`;
}

export function AdminPlatformSalesTab(props: {
  lines: AdminPlatformSalesMergedLine[];
  salesFromValue: string;
  salesToValue: string;
  salesKind: "all" | "listing" | "item" | "support" | "promotion";
  ytdTotals: PlatformSalesYtdTotals | null;
  /** Server: allow destructive clear outside prod or when env flag set. */
  clearSalesHistoryEnabled: boolean;
}) {
  const { lines, salesFromValue, salesToValue, salesKind, ytdTotals, clearSalesHistoryEnabled } = props;

  const csvBody = lines
    .map((l) => {
      const merch =
        l.kind === "listing_publication_fee" || l.kind === "promotion_purchase"
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

  const kindHref = (k: "all" | "listing" | "item" | "support" | "promotion") =>
    buildSalesTabHref({
      salesFrom: salesFromValue,
      salesTo: salesToValue,
      salesKind: k === "all" ? undefined : k,
    });

  const kindBtn = (k: "all" | "listing" | "item" | "support" | "promotion", label: string) => {
    const active = salesKind === k;
    return (
      <Link
        href={kindHref(k)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          active
            ? "border-zinc-500 bg-zinc-800/90 text-zinc-100"
            : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <section aria-label="Platform sales">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Platform sales (paid lines)
      </h2>
      <p className="mt-1 text-xs text-zinc-600">
        Paid storefront order lines (merchandise splits) plus listing publication fees and merchant promotion
        purchases (card / mock checkout). Tips and shipping are not included. Publication fees and promotions are
        platform revenue (no shop merchandise split). Free publication slots do not appear as listing rows.
      </p>

      {ytdTotals ? (
        <div className="mt-4 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-3 text-xs">
          <p className="font-medium uppercase tracking-wide text-zinc-500">
            YTD {ytdTotals.year} platform revenue (UTC, through now)
          </p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-zinc-600">Listing fees</dt>
              <dd className="tabular-nums text-zinc-200">{formatPrice(ytdTotals.listingPlatformCents)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-zinc-600">Promotions</dt>
              <dd className="tabular-nums text-zinc-200">{formatPrice(ytdTotals.promotionPlatformCents)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-zinc-600">Merchandise (platform fee)</dt>
              <dd className="tabular-nums text-zinc-200">{formatPrice(ytdTotals.itemPlatformCents)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-zinc-600">Support tips</dt>
              <dd className="tabular-nums text-zinc-200">{formatPrice(ytdTotals.supportPlatformCents)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-zinc-600">Combined</dt>
              <dd className="tabular-nums text-zinc-100">
                {formatPrice(
                  ytdTotals.listingPlatformCents +
                    ytdTotals.promotionPlatformCents +
                    ytdTotals.itemPlatformCents +
                    ytdTotals.supportPlatformCents,
                )}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by sale type">
        {kindBtn("all", "All")}
        {kindBtn("listing", "Listing")}
        {kindBtn("promotion", "Promotion")}
        {kindBtn("item", "Item")}
        {kindBtn("support", "Support")}
      </div>

      <form
        method="get"
        className="mt-4 flex flex-wrap items-end gap-3 text-xs"
        action="/admin"
      >
        <input type="hidden" name="tab" value="sales" />
        {salesKind !== "all" ? <input type="hidden" name="salesKind" value={salesKind} /> : null}
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
          Clear dates &amp; filters
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
              const isPubFee =
                l.kind === "listing_publication_fee" || l.kind === "promotion_purchase";
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
        <p className="mt-4 text-sm text-zinc-600">No matching paid lines, publication fees, or promotions.</p>
      ) : null}

      <AdminClearPlatformSalesForm enabled={clearSalesHistoryEnabled} />
    </section>
  );
}
