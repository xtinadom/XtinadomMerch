import Link from "next/link";
import {
  syncPrintifyFromCatalog,
  updateProductDetails,
  updateProductPrintifyIds,
} from "@/actions/admin";
import type { Prisma, Product, Tag } from "@/generated/prisma/client";
import {
  fetchPrintifyCatalog,
  fetchPrintifyShops,
  hasPrintifyApiToken,
  isPrintifyConfigured,
} from "@/lib/printify";
import { productImageUrls } from "@/lib/product-media";
import type { AdminTagRow } from "@/components/admin/ProductTagFields";
import { CollectionAssignmentFields } from "@/components/admin/CollectionAssignmentFields";
import { ProductTagFields } from "@/components/admin/ProductTagFields";
import { productTagIds } from "@/lib/product-tags";

const PRINTIFY_ADMIN_HIDDEN_SHOP_IDS = new Set([24222433, 26248363]);

export type PrintifyInventoryTabProps = {
  products: (Product & {
    primaryTag: Tag | null;
    tags: { tagId: string; tag: Tag }[];
  })[];
  allTags: AdminTagRow[];
  sync?: string;
  syncUpdated?: string;
  syncCreated?: string;
  syncSkipped?: string;
  syncRemoved?: string;
  syncReason?: string;
};

function formatMoneyCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function priceInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

function galleryTextareaDefault(product: {
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
}): string {
  return productImageUrls(product).join("\n");
}

export async function PrintifyInventoryTab({
  products,
  allTags,
  sync,
  syncUpdated,
  syncCreated,
  syncSkipped,
  syncRemoved,
  syncReason,
}: PrintifyInventoryTabProps) {
  const shopIdEnv = process.env.PRINTIFY_SHOP_ID?.trim() ?? "";
  const tokenSet = hasPrintifyApiToken();
  const readyForFulfillment = isPrintifyConfigured();

  let shopsAll: Awaited<ReturnType<typeof fetchPrintifyShops>> = [];
  let shopsError: string | null = null;
  let catalog: Awaited<ReturnType<typeof fetchPrintifyCatalog>> = [];
  let catalogError: string | null = null;

  if (tokenSet) {
    try {
      shopsAll = await fetchPrintifyShops();
    } catch (e) {
      shopsError = e instanceof Error ? e.message : String(e);
    }
  }

  const shops = shopsAll.filter((s) => !PRINTIFY_ADMIN_HIDDEN_SHOP_IDS.has(s.id));
  if (tokenSet && shopIdEnv) {
    try {
      catalog = await fetchPrintifyCatalog(shopIdEnv);
    } catch (e) {
      catalogError = e instanceof Error ? e.message : String(e);
    }
  }

  const shopIdNum = Number(shopIdEnv);
  const shopMatches = shopsAll.some(
    (s) => String(s.id) === shopIdEnv || (Number.isFinite(shopIdNum) && s.id === shopIdNum),
  );

  const importSlug = process.env.PRINTIFY_IMPORT_TAG_SLUG?.trim() || "mug";

  return (
    <div className="space-y-10" aria-label="Printify inventory">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Print on demand (Printify)
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          Connect your API token and shop in <code className="text-zinc-400">.env</code>, sync the catalog,
          then edit storefront copy, mockups, and Printify product / variant ids below. Paid orders submit
          to Printify from the Stripe webhook. Checkout uses card + Cash App for POD unless every line in
          the cart agrees otherwise.
        </p>
      </div>

      {sync === "ok" && (
        <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200/90">
          Sync finished: updated {syncUpdated ?? "0"}, created {syncCreated ?? "0"}, skipped (unmapped){" "}
          {syncSkipped ?? "0"}, removed (no longer in Printify catalog) {syncRemoved ?? "0"} — deleted unless
          the product was on a past order (then archived and hidden).
        </p>
      )}
      {sync === "err" && (
        <p className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200/90">
          Sync could not run
          {syncReason === "no_shop"
            ? " — set PRINTIFY_SHOP_ID in .env."
            : syncReason === "no_tag"
              ? " — no tag found (set PRINTIFY_IMPORT_TAG_SLUG or run seed)."
              : "."}
        </p>
      )}

      {readyForFulfillment && (
        <section className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-medium text-zinc-200">Automatic mapping</h3>
          <p className="mt-1 text-xs text-zinc-500">
            One storefront product per Printify product id: pulls every enabled variant into a dropdown on
            the product page. Matches existing rows by Printify product id, then unmapped POD rows by slug or
            title. New products get tag{" "}
            <code className="text-zinc-400">{importSlug}</code> and audience{" "}
            <code className="text-zinc-400">
              {process.env.PRINTIFY_IMPORT_AUDIENCE?.trim() || "both"}
            </code>{" "}
            (override via <code className="text-zinc-400">.env</code>).
          </p>
          <form action={syncPrintifyFromCatalog} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" name="createMissing" className="rounded border-zinc-600" />
              Create storefront products for Printify catalog items that did not match any row
            </label>
            <button
              type="submit"
              className="rounded bg-rose-900/80 px-4 py-2 text-xs font-medium text-rose-100 hover:bg-rose-800/80"
            >
              Sync from Printify
            </button>
          </form>
        </section>
      )}

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
            <span className="text-zinc-400">PRINTIFY_IMPORT_TAG_SLUG</span> — new listings default tag (
            <code className="text-zinc-400">{importSlug}</code>)
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
            <p className="mt-2 text-sm text-rose-400/90">{shopsError}</p>
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
                  <code className="text-rose-300/80">{s.id}</code>
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

      {tokenSet && shopIdEnv && (
        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Your Printify catalog</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Reference for ids. The storefront uses one product per Printify product id; customers pick a
            variant on the product page. Default variant id in mappings below is the first enabled variant
            after sync.
          </p>
          {catalogError ? (
            <p className="mt-2 text-sm text-rose-400/90">{catalogError}</p>
          ) : catalog.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No products in this Printify shop yet.</p>
          ) : (
            <div className="mt-4 max-h-[min(420px,50vh)] overflow-auto rounded-lg border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                  <tr>
                    <th className="p-2 font-medium">Product id</th>
                    <th className="p-2 font-medium">Title</th>
                    <th className="p-2 font-medium">Variants</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-400">
                  {catalog.map((p) => (
                    <tr key={p.id} className="border-t border-zinc-800/80">
                      <td className="p-2 font-mono text-rose-300/80">{p.id}</td>
                      <td className="p-2 text-zinc-300">{p.title}</td>
                      <td className="p-2">
                        <ul className="space-y-0.5">
                          {p.variants.map((v) => (
                            <li key={v.id}>
                              <span className="font-mono text-zinc-500">{v.id}</span>
                              {" — "}
                              {v.title}
                              {v.priceCents > 0 ? (
                                <span className="ml-1 text-zinc-600">
                                  ({formatMoneyCents(v.priceCents)})
                                </span>
                              ) : null}
                              {!v.enabled ? (
                                <span className="ml-1 text-amber-600/80">(disabled)</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Storefront listings &amp; Printify ids
        </h3>
        <p className="mt-1 text-xs text-zinc-600">
          Sync fills product id, default variant id, and the full variant list. Override ids below if needed;
          run sync again to refresh variant options from Printify. Checkout sends the customer&apos;s chosen
          variant on each order line to Printify.
        </p>
        <ul className="mt-4 space-y-6">
          {products.map((p) => (
            <li key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-4">
              <div className="mb-3 flex flex-wrap items-start gap-3 text-xs text-zinc-500">
                {productImageUrls(p)[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productImageUrls(p)[0]}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded border border-zinc-700 object-cover"
                  />
                ) : null}
                <div>
                  <span className="text-zinc-400">
                    {p.tags.map((x) => x.tag.name).join(" · ") || p.primaryTag?.name || "—"}
                  </span>
                  {" · "}
                  <Link
                    href={`/product/${p.slug}`}
                    className="text-rose-400/90 hover:underline"
                  >
                    /product/{p.slug}
                  </Link>
                  {p.active ? "" : " · inactive"}
                </div>
              </div>
              <form action={updateProductDetails.bind(null, p.id)} className="space-y-3">
                <label className="block text-xs text-zinc-500">
                  Title
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={p.name}
                    className="mt-1 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Description
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={p.description ?? ""}
                    className="mt-1 block w-full max-w-2xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </label>
                <ProductTagFields
                  key={`printify-${p.id}-${productTagIds(p).join("-")}`}
                  tags={allTags}
                  defaultTagIds={productTagIds(p)}
                />
                <CollectionAssignmentFields audience={p.audience} />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    name="checkoutTipEligible"
                    defaultChecked={p.checkoutTipEligible}
                    className="rounded border-zinc-600"
                  />
                  Allow checkout tip (sub-eligible items only)
                </label>
                <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Payment at checkout
                  </span>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      name="payCard"
                      defaultChecked={p.payCard}
                      className="rounded border-zinc-600"
                    />
                    Card
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      name="payCashApp"
                      defaultChecked={p.payCashApp}
                      className="rounded border-zinc-600"
                    />
                    Cash App
                  </label>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Stripe only shows methods every line in the cart allows.
                </p>
                <label className="block text-xs text-zinc-500">
                  Photo URLs (mockups; one per line)
                  <textarea
                    name="gallery"
                    rows={4}
                    defaultValue={galleryTextareaDefault(p)}
                    className="mt-1 block w-full max-w-2xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-300"
                  />
                </label>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block text-xs text-zinc-500">
                    Price (USD)
                    <input
                      type="number"
                      name="price"
                      required
                      min={0}
                      step={0.01}
                      defaultValue={priceInputValue(p.priceCents)}
                      className="mt-1 block w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={p.active}
                      className="rounded border-zinc-600"
                    />
                    Visible in shop
                  </label>
                  <button
                    type="submit"
                    className="rounded bg-rose-900/80 px-3 py-2 text-xs font-medium text-rose-100 hover:bg-rose-800/80"
                  >
                    Save listing
                  </button>
                </div>
              </form>

              <div className="mt-4 border-t border-zinc-800 pt-4">
                <p className="text-xs text-zinc-500">Printify API mapping</p>
                <form
                  action={updateProductPrintifyIds.bind(null, p.id)}
                  className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
                >
                  <label className="block text-xs text-zinc-500">
                    Printify product id
                    <input
                      type="text"
                      name="printifyProductId"
                      defaultValue={p.printifyProductId ?? ""}
                      placeholder="e.g. 648192aa…"
                      autoComplete="off"
                      className="mt-1 block w-full min-w-[12rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-200 sm:w-56"
                    />
                  </label>
                  <label className="block text-xs text-zinc-500">
                    Printify variant id
                    <input
                      type="text"
                      name="printifyVariantId"
                      defaultValue={p.printifyVariantId ?? ""}
                      placeholder="e.g. 120"
                      autoComplete="off"
                      className="mt-1 block w-full min-w-[8rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-200 sm:w-36"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded bg-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700"
                  >
                    Save mapping
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">No Printify products in the database.</p>
        ) : null}
      </section>
    </div>
  );
}
