import Link from "next/link";
import { registerPrintifyStorefrontWebhook } from "@/actions/printify-webhooks";
import {
  fetchPrintifyShops,
  hasPrintifyApiToken,
  isPrintifyConfigured,
  listPrintifyWebhooks,
} from "@/lib/printify";
import { webhookPublicBaseUrl } from "@/lib/public-app-url";
import { ADMIN_BACKEND_BASE_PATH } from "@/lib/admin-dashboard-urls";

const PRINTIFY_ADMIN_HIDDEN_SHOP_IDS = new Set([24222433, 26248363]);

export type PrintifyApiTabProps = {
  hookBanner?: { variant: "ok" | "err"; text: string };
};

export async function PrintifyApiTab({ hookBanner }: PrintifyApiTabProps = {}) {
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

  const webhookSecretSet = Boolean(process.env.PRINTIFY_WEBHOOK_SECRET?.trim());
  const publicBase = webhookPublicBaseUrl();
  const webhookEndpoint = publicBase ? `${publicBase}/api/webhooks/printify` : null;

  let printifyWebhooks: Awaited<ReturnType<typeof listPrintifyWebhooks>> = [];
  let webhooksListError: string | null = null;
  if (tokenSet && shopIdEnv) {
    try {
      printifyWebhooks = await listPrintifyWebhooks(shopIdEnv);
    } catch (e) {
      webhooksListError = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="space-y-10" aria-label="Printify API">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Printify API</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Environment variables and the shop list from the Printify API. Sync, catalog reference, and
          storefront listings are on the{" "}
          <Link href={`${ADMIN_BACKEND_BASE_PATH}?tab=printify`} className="text-blue-400/90 hover:underline">
            Printify items
          </Link>{" "}
          tab.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-amber-600/90">
          <strong className="font-medium text-amber-500/95">API / custom storefront:</strong> Do not use Printify’s
          &quot;Publish&quot; button — it queues products forever. When a product is live here, use{" "}
          <strong className="font-medium text-amber-500/95">Toggle published</strong> on the{" "}
          <Link href={`${ADMIN_BACKEND_BASE_PATH}?tab=printify`} className="text-blue-400/90 underline-offset-2 hover:underline">
            Printify items
          </Link>{" "}
          catalog. To unstick a stuck queue, disconnect a channel in Printify’s help:{" "}
          <a
            href="https://help.printify.com/hc/en-us/articles/4652212823697-How-can-I-disconnect-my-store-from-Printify"
            className="text-blue-400/90 underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            disconnect store
          </a>
          .
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
            <span className="text-zinc-400">PRINTIFY_IMPORT_TAG_SLUG</span> —{" "}
            <span className="text-zinc-500">
              optional legacy; catalog sync now assigns the <code className="text-zinc-400">no-tag</code> tag until
              you set type tags on each listing
            </span>
          </li>
          <li>
            <span className="text-zinc-400">PRINTIFY_WEBHOOK_SECRET</span> —{" "}
            {webhookSecretSet ? (
              "set (hidden) — used to verify Printify → storefront callbacks"
            ) : (
              <>
                optional locally; <strong className="font-medium text-zinc-400">required in production</strong> for{" "}
                <code className="text-zinc-400">/api/webhooks/printify</code> — use a long random string (16+
                characters)
              </>
            )}
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

      {readyForFulfillment ? (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <h3 className="text-sm font-medium text-zinc-200">Register storefront with Printify</h3>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Your admin can read the catalog because the API token is valid. Printify also expects a{" "}
            <strong className="font-medium text-zinc-400">public HTTPS webhook URL</strong> registered on the same
            shop so their systems know where to send order events (this is how custom / API storefronts are wired in
            their API model).
          </p>
          {hookBanner ? (
            <p
              role={hookBanner.variant === "err" ? "alert" : "status"}
              className={
                hookBanner.variant === "err"
                  ? "mt-3 rounded-lg border border-blue-900/50 bg-blue-950/30 px-3 py-2 text-sm text-blue-200/90"
                  : "mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200/90"
              }
            >
              {hookBanner.text}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-zinc-500">
            Webhook endpoint (must be reachable from the internet — use your live domain, not localhost):
          </p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-300">
            {webhookEndpoint ?? (
              <span className="text-amber-400/90">
                Set <code className="text-zinc-400">NEXT_PUBLIC_APP_URL</code> to your https site URL (Vercel: also
                works from VERCEL_URL in production).
              </span>
            )}
          </p>
          {!webhookSecretSet ? (
            <p className="mt-2 text-xs text-amber-400/90">
              Add <code className="text-zinc-400">PRINTIFY_WEBHOOK_SECRET</code> to the environment before
              registering (same value is sent to Printify for HMAC verification).
            </p>
          ) : null}
          <form action={registerPrintifyStorefrontWebhook} className="mt-4">
            <button
              type="submit"
              disabled={!webhookEndpoint || !webhookSecretSet}
              className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Register order webhook with Printify
            </button>
          </form>
          <p className="mt-2 text-xs text-zinc-600">
            Registers topic <code className="text-zinc-400">order:created</code> pointing at the URL above. Safe to
            click again if it is already registered — you will see a duplicate message, not a second hook.
          </p>
          {tokenSet && shopIdEnv ? (
            <div className="mt-6">
              <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Webhooks on this shop (Printify API)
              </h4>
              {webhooksListError ? (
                <p className="mt-2 text-sm text-blue-400/90">{webhooksListError}</p>
              ) : printifyWebhooks.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-600">No webhooks registered yet.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-xs text-zinc-400">
                  {printifyWebhooks.map((w) => (
                    <li key={w.id} className="rounded border border-zinc-800/80 bg-zinc-950/40 p-2">
                      <span className="text-zinc-500">{w.topic}</span>
                      <div className="mt-1 break-all font-mono text-zinc-300">{w.url}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

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
