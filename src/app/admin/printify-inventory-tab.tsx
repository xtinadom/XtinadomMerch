import Link from "next/link";
import {
  resyncPrintifyCatalogProduct,
  syncPrintifyFromCatalog,
  updateProductDetails,
  updateProductPrintifyIds,
} from "@/actions/admin";
import type { Prisma, Product, Tag } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { fetchPrintifyCatalog, hasPrintifyApiToken, isPrintifyConfigured } from "@/lib/printify";
import { productImageUrls } from "@/lib/product-media";
import type { AdminTagRow } from "@/components/admin/ProductTagFields";
import { CollectionAssignmentFields } from "@/components/admin/CollectionAssignmentFields";
import { ProductTagFields } from "@/components/admin/ProductTagFields";
import { productTagIds } from "@/lib/product-tags";
import { ListingGalleryEditor } from "@/components/admin/ListingGalleryEditor";
import { SaveListingForm } from "@/components/admin/SaveListingForm";

export type PrintifyInventoryTabProps = {
  products: (Product & {
    primaryTag: Tag | null;
    tags: { tagId: string; tag: Tag }[];
  })[];
  allTags: AdminTagRow[];
  sync?: string;
  syncMode?: string;
  syncUpdated?: string;
  syncCreated?: string;
  syncSkipped?: string;
  syncRemoved?: string;
  syncReason?: string;
  listingSavedId?: string;
};

function priceInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function PrintifyInventoryTab({
  products,
  allTags,
  sync,
  syncMode,
  syncUpdated,
  syncCreated,
  syncSkipped,
  syncRemoved,
  syncReason,
  listingSavedId,
}: PrintifyInventoryTabProps) {
  const readyForFulfillment = isPrintifyConfigured();
  const shopIdEnv = process.env.PRINTIFY_SHOP_ID?.trim() ?? "";
  const tokenSet = hasPrintifyApiToken();

  let catalog: Awaited<ReturnType<typeof fetchPrintifyCatalog>> = [];
  let catalogError: string | null = null;
  const storefrontByPrintifyId = new Map<string, boolean>();
  if (tokenSet && shopIdEnv) {
    try {
      catalog = await fetchPrintifyCatalog(shopIdEnv);
    } catch (e) {
      catalogError = e instanceof Error ? e.message : String(e);
    }
    const linkedProducts = await prisma.product.findMany({
      where: {
        fulfillmentType: FulfillmentType.printify,
        printifyProductId: { not: null },
      },
      select: { printifyProductId: true, active: true },
    });
    for (const row of linkedProducts) {
      const pid = row.printifyProductId?.trim();
      if (pid) storefrontByPrintifyId.set(pid, row.active);
    }
  }

  const importSlug = process.env.PRINTIFY_IMPORT_TAG_SLUG?.trim() || "mug";

  return (
    <div className="space-y-10" aria-label="Printify inventory">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Print on demand (Printify)
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          Set token and shop in <code className="text-zinc-400">.env</code> (
          <Link href="/admin?tab=printify-api" className="text-rose-400/90 hover:underline">
            Printify API
          </Link>
          ), sync, then edit listings below. Orders go to Printify via the Stripe webhook.
        </p>
      </div>

      {sync === "ok" && (
        <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200/90">
          {syncMode === "single" ? (
            <>
              <span className="font-medium text-emerald-100/95">Single product resync</span> finished: updated{" "}
              {syncUpdated ?? "0"}, created {syncCreated ?? "0"}, skipped {syncSkipped ?? "0"}, removed{" "}
              {syncRemoved ?? "0"}.
            </>
          ) : (
            <>
              <span className="font-medium text-emerald-100/95">
                {syncMode === "new"
                  ? "Sync new"
                  : syncMode === "resync"
                    ? "Resync existing"
                    : "Full sync"}
              </span>{" "}
              finished: updated {syncUpdated ?? "0"}, created {syncCreated ?? "0"}, skipped{" "}
              {syncSkipped ?? "0"}
              {syncMode === "new" ? (
                <> — new rows only; no updates or orphan cleanup.</>
              ) : (
                <>
                  , removed {syncRemoved ?? "0"} (gone from catalog; archived if ordered before).
                </>
              )}
            </>
          )}
        </p>
      )}
      {sync === "err" && (
        <p className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200/90">
          Sync could not run
          {syncReason === "no_shop"
            ? " — set PRINTIFY_SHOP_ID in .env."
            : syncReason === "catalog_not_found"
                ? " — Printify did not return that product id (check the id or API token)."
                : syncReason === "no_product"
                  ? " — missing Printify product id."
                  : "."}
        </p>
      )}

      {readyForFulfillment && (
        <section className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-medium text-zinc-200">Automatic mapping</h3>
          <p className="mt-1 text-xs text-zinc-500">
            <strong className="font-medium text-zinc-400">Full</strong>: update all, add missing, remove orphans.{" "}
            <strong className="font-medium text-zinc-400">Sync new</strong>: create only.{" "}
            <strong className="font-medium text-zinc-400">Resync existing</strong>: update linked only. New rows:
            tag <code className="text-zinc-400">{importSlug}</code>, audience{" "}
            <code className="text-zinc-400">{process.env.PRINTIFY_IMPORT_AUDIENCE?.trim() || "both"}</code>.
          </p>
          <form
            action={syncPrintifyFromCatalog}
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3"
          >
            <button
              type="submit"
              name="syncMode"
              value="new"
              className="self-start rounded bg-rose-900/80 px-4 py-2 text-xs font-medium text-rose-100 hover:bg-rose-800/80"
            >
              Sync new
            </button>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end sm:gap-3 sm:self-center">
              <button
                type="submit"
                name="syncMode"
                value="full"
                className="rounded border border-zinc-600 bg-zinc-800/60 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700/60"
              >
                Full sync
              </button>
              <button
                type="submit"
                name="syncMode"
                value="resync"
                className="rounded border border-zinc-600 bg-zinc-800/60 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700/60"
              >
                Resync existing
              </button>
            </div>
          </form>
        </section>
      )}

      {tokenSet && shopIdEnv && (
        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Your Printify catalog</h3>
          <p className="mt-1 text-xs text-zinc-600">
            <strong className="font-medium text-zinc-500">Shop</strong>:{" "}
            <span className="text-emerald-500/90">Listed</span> / <span className="text-zinc-500">Hidden</span> /{" "}
            <span className="text-amber-600/90">Not listed</span>. <strong className="font-medium text-zinc-500">Resync</strong>{" "}
            updates one Printify product from the API.
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
                    <th className="p-2 font-medium">Shop</th>
                    <th className="p-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-400">
                  {catalog.map((p) => {
                    const active = storefrontByPrintifyId.get(p.id);
                    const shopCell =
                      active === undefined ? (
                        <span className="text-amber-600/90">Not listed</span>
                      ) : active ? (
                        <span className="text-emerald-400/90">Listed</span>
                      ) : (
                        <span className="text-zinc-500">Hidden</span>
                      );
                    return (
                      <tr key={p.id} className="border-t border-zinc-800/80">
                        <td className="p-2 font-mono text-rose-300/80">{p.id}</td>
                        <td className="p-2 text-zinc-300">{p.title}</td>
                        <td className="p-2 whitespace-nowrap">{shopCell}</td>
                        <td className="p-2 whitespace-nowrap">
                          <form action={resyncPrintifyCatalogProduct}>
                            <input type="hidden" name="printifyProductId" value={p.id} />
                            <button
                              type="submit"
                              className="rounded border border-zinc-600 bg-zinc-800/60 px-2 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700/60"
                            >
                              Resync
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
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
          Sync fills ids and variants; override below if needed. Checkout sends the chosen variant per line.
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
              <SaveListingForm
                action={updateProductDetails.bind(null, p.id)}
                savedHighlight={listingSavedId === p.id}
              >
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
                <ListingGalleryEditor defaultUrls={productImageUrls(p)} />
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
                </div>
              </SaveListingForm>

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
