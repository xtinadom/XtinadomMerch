import Link from "next/link";
import { fetchPrintifyShops, hasPrintifyApiToken, isPrintifyConfigured } from "@/lib/printify";

const PRINTIFY_ADMIN_HIDDEN_SHOP_IDS = new Set([24222433, 26248363]);

export async function PrintifyApiTab() {
  const shopIdEnv = process.env.PRINTIFY_SHOP_ID?.trim() ?? "";
  const tokenSet = hasPrintifyApiToken();
  const readyForFulfillment = isPrintifyConfigured();

  let shopsAll: Awaited<ReturnType<typeof fetchPrintifyShops>> = [];
  let shopsError: string | null = null;

  if (tokenSet) {
    try {
      shopsAll = await fetchPrintifyShops();
    } catch (e) {
      shopsError = e instanceof Error ? e.message : String(e);
    }
  }

  const shops = shopsAll.filter((s) => !PRINTIFY_ADMIN_HIDDEN_SHOP_IDS.has(s.id));

  const shopIdNum = Number(shopIdEnv);
  const shopMatches = shopsAll.some(
    (s) => String(s.id) === shopIdEnv || (Number.isFinite(shopIdNum) && s.id === shopIdNum),
  );

  const importSlug = process.env.PRINTIFY_IMPORT_TAG_SLUG?.trim() || "mug";

  return (
    <div className="space-y-10" aria-label="Printify API">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Printify API</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Environment variables and the shop list from the Printify API. Sync, catalog reference, and
          storefront listings are on the{" "}
          <Link href="/admin?tab=printify" className="text-blue-400/90 hover:underline">
            Printify items
          </Link>{" "}
          tab.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="text-sm font-medium text-zinc-200">Environment</h3>
        <ul className="mt-3 space-y-2 text-xs text-zinc-500">
          <li>
            <span className="text-zinc-400">PRINTIFY_API_TOKEN</span> —{" "}
            {process.env.PRINTIFY_API_TOKEN?.trim()
              ? "set (hidden)"
              : "missing — create at printify.com → Account → Connections → API tokens"}
          </li>
          <li>
            <span className="text-zinc-400">PRINTIFY_SHOP_ID</span> —{" "}
            {shopIdEnv ? (
              <code className="text-zinc-400">{shopIdEnv}</code>
            ) : (
              <>
                missing — copy the numeric id from{" "}
                <strong className="font-medium text-zinc-400">API check — shops</strong> below into{" "}
                <code className="text-zinc-400">.env</code> as{" "}
                <code className="text-zinc-400">PRINTIFY_SHOP_ID</code>, then restart the dev server
              </>
            )}
          </li>
          <li>
            <span className="text-zinc-400">PRINTIFY_SHIPPING_METHOD</span> —{" "}
            {process.env.PRINTIFY_SHIPPING_METHOD ?? "1"} (Printify shipping method id for orders)
          </li>
          <li>
            <span className="text-zinc-400">PRINTIFY_IMPORT_TAG_SLUG</span> — default tag for new listings (
            <code className="text-zinc-400">{importSlug}</code>); created on first sync if missing
          </li>
        </ul>
        {!tokenSet && (
          <p className="mt-4 text-xs text-amber-400/90">
            Add <code className="text-zinc-400">PRINTIFY_API_TOKEN</code> to{" "}
            <code className="text-zinc-400">.env</code>, restart the dev server, then refresh — you’ll see
            your shop ids below.
          </p>
        )}
        {tokenSet && !shopIdEnv && (
          <p className="mt-4 text-xs text-amber-400/90">
            Token is set. Use the shop list below, add{" "}
            <code className="text-zinc-400">PRINTIFY_SHOP_ID=&lt;that number&gt;</code> to{" "}
            <code className="text-zinc-400">.env</code>, restart, and refresh so the catalog loads.
          </p>
        )}
        {readyForFulfillment && (
          <p className="mt-4 text-xs text-emerald-400/90">
            Token and shop id are set — paid orders can be sent to Printify for mapped products.
          </p>
        )}
      </section>

      {tokenSet && (
        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-500">API check — shops</h3>
          {shopsError ? (
            <p className="mt-2 text-sm text-blue-400/90">{shopsError}</p>
          ) : shopsAll.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No shops returned for this token.</p>
          ) : shops.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              No storefront shops to show (others are hidden on this page).
            </p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-zinc-300">
              {shops.map((s) => (
                <li key={s.id}>
                  <code className="text-blue-300/80">{s.id}</code>
                  {" — "}
                  {s.title}
                  {String(s.id) === shopIdEnv || s.id === shopIdNum ? (
                    <span className="ml-2 text-xs text-emerald-400">← matches PRINTIFY_SHOP_ID</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {shopsAll.length > shops.length ? (
            <p className="mt-2 text-xs text-zinc-600">
              {shopsAll.length - shops.length} other Printify shop
              {shopsAll.length - shops.length === 1 ? "" : "s"} (e.g. Etsy / Big Cartel) omitted here.
            </p>
          ) : null}
          {shops.length > 0 && shopIdEnv && !shopMatches && !shopsError ? (
            <p className="mt-3 text-xs text-amber-400/90">
              PRINTIFY_SHOP_ID does not match any shop above — fix the id in{" "}
              <code className="text-zinc-400">.env</code>.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
