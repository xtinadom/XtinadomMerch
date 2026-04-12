import Link from "next/link";
import {
  adminPruneOrphanListingImagesR2,
  notifyPrintifyPublishingSucceeded,
  resyncPrintifyCatalogProduct,
  syncPrintifyFromCatalog,
  updateProductDetails,
} from "@/actions/admin";
import type { Prisma, Product, Tag } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { fetchPrintifyCatalog, hasPrintifyApiToken, isPrintifyConfigured } from "@/lib/printify";
import { isR2UploadConfigured } from "@/lib/r2-upload";
import { pickImageForVariant } from "@/lib/printify-catalog";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { productImageUrls } from "@/lib/product-media";
import type { AdminTagRow } from "@/components/admin/ProductTagFields";
import { CollectionAssignmentFields } from "@/components/admin/CollectionAssignmentFields";
import { ProductDesignNameFields } from "@/components/admin/ProductDesignNameFields";
import { ProductTagFields } from "@/components/admin/ProductTagFields";
import {
  collectKnownDesignNamesFromProducts,
  designNamesFromJson,
} from "@/lib/product-design-names";
import { productTagIds } from "@/lib/product-tags";
import { AdminProductPreviewButton } from "@/components/admin/AdminProductPreviewButton";
import { ListingGalleryEditor } from "@/components/admin/ListingGalleryEditor";
import { SaveListingForm } from "@/components/admin/SaveListingForm";
import { PrintifyCatalogSyncButtons } from "@/components/admin/PrintifyCatalogSyncButtons";

export type PrintifyInventoryTabProps = {
  products: (Product & {
    primaryTag: Tag | null;
    tags: { tagId: string; tag: Tag }[];
  })[];
  allTags: AdminTagRow[];
  sync?: string;
  syncMode?: string;
  /** ISO timestamp from redirect after a successful full sync (`fullSyncAt` query). */
  fullSyncAtIso?: string;
  syncUpdated?: string;
  syncCreated?: string;
  syncSkipped?: string;
  syncRemoved?: string;
  syncReason?: string;
  /** `listing` query — which product form is shown (one at a time). */
  openListingId?: string;
  listingSavedId?: string;
  publishNotice?:
    | { variant: "ok"; kind: "succeeded" | "failed"; productId?: string }
    | {
        variant: "err";
        reason?: string;
        productId?: string;
        detail?: string;
      };
  r2PruneNotice?:
    | { variant: "preview"; listed: number; referenced: number; orphans: number }
    | {
        variant: "ok";
        listed: number;
        referenced: number;
        orphans: number;
        deleted: number;
      }
    | { variant: "err"; reason: string };
};

function priceInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

function PrintifyListingPriceFields({
  listing,
}: {
  listing: Pick<
    Product,
    "fulfillmentType" | "printifyVariants" | "printifyVariantId" | "priceCents"
  >;
}) {
  const variants = getPrintifyVariantsForProduct(listing);
  if (variants.length === 0) {
    return (
      <label className="block text-xs text-zinc-500">
        Price (USD)
        <input
          type="number"
          name="price"
          required
          min={0}
          step={0.01}
          defaultValue={priceInputValue(listing.priceCents)}
          className="mt-1 block w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm"
        />
      </label>
    );
  }
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Prices (USD)</p>
      <ul className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-3">
        {variants.map((v) => (
          <li key={v.id} className="w-32 shrink-0">
            <label className="block text-xs text-zinc-500">
              <span className="line-clamp-2 block leading-snug text-zinc-400">{v.title}</span>
              <input
                type="number"
                name={`variantPrice_${v.id}`}
                required
                min={0}
                step={0.01}
                defaultValue={priceInputValue(v.priceCents)}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100"
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CatalogTableAngleGlyph() {
  return (
    <span className="font-mono text-[12px] font-semibold leading-none tracking-tight" aria-hidden>
      {"<>"}
    </span>
  );
}

function CatalogResyncIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="size-[15px] shrink-0"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

/** Local date `MM/DD` and time `h:mm am|pm` for a two-line table cell. */
function formatListingUpdatedParts(d: Date): { date: string; time: string } {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h24 = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const isAm = h24 < 12;
  const h12 = h24 % 12 || 12;
  const ap = isAm ? "am" : "pm";
  return { date: `${mm}/${dd}`, time: `${h12}:${mins} ${ap}` };
}

export async function PrintifyInventoryTab({
  products,
  allTags,
  sync,
  syncMode,
  fullSyncAtIso,
  syncUpdated,
  syncCreated,
  syncSkipped,
  syncRemoved,
  syncReason,
  openListingId,
  listingSavedId,
  publishNotice,
  r2PruneNotice,
}: PrintifyInventoryTabProps) {
  const readyForFulfillment = isPrintifyConfigured();
  const shopIdEnv = process.env.PRINTIFY_SHOP_ID?.trim() ?? "";
  const tokenSet = hasPrintifyApiToken();

  let catalog: Awaited<ReturnType<typeof fetchPrintifyCatalog>> = [];
  let catalogError: string | null = null;
  const productIdByPrintifyId = new Map<string, string>();
  const updatedAtByPrintifyId = new Map<string, Date>();
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
      select: { id: true, printifyProductId: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    });
    for (const row of linkedProducts) {
      const pid = row.printifyProductId?.trim();
      if (!pid) continue;
      if (!productIdByPrintifyId.has(pid)) productIdByPrintifyId.set(pid, row.id);
      const prev = updatedAtByPrintifyId.get(pid);
      if (!prev || row.updatedAt > prev) {
        updatedAtByPrintifyId.set(pid, row.updatedAt);
      }
    }
  }

  const listingProductByPrintifyId = new Map<
    string,
    PrintifyInventoryTabProps["products"][number]
  >();
  for (const [printifyId, productId] of productIdByPrintifyId) {
    const pr = products.find((x) => x.id === productId);
    if (pr) listingProductByPrintifyId.set(printifyId, pr);
  }

  const selectedListing = openListingId
    ? (products.find((p) => p.id === openListingId) ?? null)
    : null;

  const knownDesignNames = collectKnownDesignNamesFromProducts(products);

  return (
    <div className="space-y-10" aria-label="Printify inventory">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Print on demand (Printify)
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          Set token and shop in <code className="text-zinc-400">.env</code> (
          <Link href="/admin?tab=printify-api" className="text-blue-400/90 hover:underline">
            Printify API
          </Link>
          ), sync, then use <strong className="font-medium text-zinc-500">Edit</strong> in the catalog to change a
          storefront listing. Orders go to Printify via the Stripe webhook.
        </p>
      </div>

      {publishNotice?.variant === "ok" ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200/90"
        >
          {publishNotice.kind === "succeeded" ? (
            <>
              Printify product marked as <span className="font-medium text-emerald-100/95">published</span>
              {publishNotice.productId ? (
                <>
                  {" "}
                  (<code className="text-emerald-300/90">{publishNotice.productId}</code>).
                </>
              ) : (
                "."
              )}
            </>
          ) : (
            <>
              Stuck publishing cleared via <code className="text-emerald-300/90">publishing_failed</code>
              {publishNotice.productId ? (
                <>
                  {" "}
                  (<code className="text-emerald-300/90">{publishNotice.productId}</code>).
                </>
              ) : (
                "."
              )}
            </>
          )}
        </p>
      ) : null}
      {publishNotice?.variant === "err" ? (
        <p
          role="alert"
          className="rounded-lg border border-blue-900/60 bg-blue-950/40 px-4 py-3 text-sm text-blue-200/90"
        >
          {publishNotice.reason === "no_shop"
            ? "Set PRINTIFY_SHOP_ID in the environment."
            : publishNotice.reason === "no_product"
              ? "Missing Printify product id."
              : publishNotice.reason === "api"
                ? `Printify API error${publishNotice.productId ? ` (${publishNotice.productId})` : ""}: ${publishNotice.detail ?? "Unknown error."}`
                : publishNotice.detail ?? "Could not update publish status."}
        </p>
      ) : null}

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
        <p className="rounded-lg border border-blue-900/60 bg-blue-950/40 px-4 py-3 text-sm text-blue-200/90">
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

      {(readyForFulfillment || isR2UploadConfigured()) ? (
        <section
          aria-label="Printify catalog sync and R2 listing image cleanup"
          className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            {readyForFulfillment ? (
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Catalog sync
                </h3>
                <PrintifyCatalogSyncButtons
                  action={syncPrintifyFromCatalog}
                  lastOkMode={
                    sync === "ok" && (syncMode === "new" || syncMode === "full")
                      ? syncMode
                      : undefined
                  }
                  fullSyncAtIso={fullSyncAtIso}
                />
              </div>
            ) : null}
            {readyForFulfillment && isR2UploadConfigured() ? (
              <div className="hidden h-auto w-px shrink-0 self-stretch bg-zinc-800 sm:block" aria-hidden />
            ) : null}
            {isR2UploadConfigured() ? (
              <div
                className={
                  readyForFulfillment
                    ? "min-w-0 flex-1 border-t border-zinc-800 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4"
                    : "min-w-0 flex-1"
                }
              >
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  R2 listing images
                </h3>
                {r2PruneNotice?.variant === "preview" ? (
                  <p
                    role="status"
                    className="mt-2 rounded-md border border-amber-900/50 bg-amber-950/30 px-2.5 py-1.5 text-[11px] text-amber-200/90"
                  >
                    <span className="font-medium text-amber-100/90">Preview:</span>{" "}
                    {r2PruneNotice.listed} under <code className="text-amber-200/80">listing/</code>,{" "}
                    {r2PruneNotice.referenced} referenced,{" "}
                    <span className="font-medium text-amber-100/90">{r2PruneNotice.orphans} orphan(s)</span>.
                  </p>
                ) : null}
                {r2PruneNotice?.variant === "ok" ? (
                  <p
                    role="status"
                    className="mt-2 rounded-md border border-emerald-900/50 bg-emerald-950/30 px-2.5 py-1.5 text-[11px] text-emerald-200/90"
                  >
                    <span className="font-medium text-emerald-100/90">Done.</span> Deleted {r2PruneNotice.deleted}{" "}
                    orphan(s); scanned {r2PruneNotice.listed}, {r2PruneNotice.referenced} still referenced.
                  </p>
                ) : null}
                {r2PruneNotice?.variant === "err" ? (
                  <p
                    role="alert"
                    className="mt-2 rounded-md border border-red-900/50 bg-red-950/30 px-2.5 py-1.5 text-[11px] text-red-200/90"
                  >
                    {r2PruneNotice.reason === "no_r2"
                      ? "R2 is not configured in the environment."
                      : r2PruneNotice.reason === "confirm_required"
                        ? "Check the confirmation box before deleting orphans."
                        : r2PruneNotice.reason}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <form action={adminPruneOrphanListingImagesR2}>
                    <input type="hidden" name="intent" value="preview" />
                    <button
                      type="submit"
                      className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800"
                    >
                      Preview orphans
                    </button>
                  </form>
                  <form action={adminPruneOrphanListingImagesR2} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="intent" value="delete" />
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-500">
                      <input type="checkbox" name="confirm" className="rounded border-zinc-600" />
                      I understand this deletes files
                    </label>
                    <button
                      type="submit"
                      className="rounded border border-red-900/60 bg-red-950/40 px-2.5 py-1.5 text-[11px] font-medium text-red-200/90 hover:bg-red-950/60"
                    >
                      Delete orphans
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {tokenSet && shopIdEnv && (
        <section>
          <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-medium uppercase tracking-wide text-zinc-500">
            <span>Your Printify catalog</span>
            {!catalogError ? (
              <span className="font-normal normal-case tracking-normal text-zinc-600">
                {catalog.length} {catalog.length === 1 ? "item" : "items"}
              </span>
            ) : null}
          </h3>
          {catalogError ? (
            <p className="mt-2 text-sm text-blue-400/90">{catalogError}</p>
          ) : catalog.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No products in this Printify shop yet.</p>
          ) : (
            <div className="mt-4 max-h-[min(420px,50vh)] overflow-auto rounded-lg border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                  <tr>
                    <th className="w-14 p-2 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                      Img
                    </th>
                    <th className="p-2 font-medium">Title</th>
                    <th className="p-2 text-center font-medium whitespace-nowrap">Updated</th>
                    <th className="p-2 text-center font-medium whitespace-nowrap">Edit</th>
                    <th className="p-2 text-center font-medium whitespace-nowrap">Resync</th>
                    <th className="p-2 text-center font-medium whitespace-nowrap">
                      Toggle published
                    </th>
                  </tr>
                </thead>
                <tbody className="text-zinc-400">
                  {catalog.map((p) => {
                    const enabledVariants = p.variants.filter((v) => v.enabled);
                    const catalogHero =
                      enabledVariants.length > 0
                        ? pickImageForVariant(p.images, enabledVariants[0]!.id)
                        : (p.images[0]?.src ?? null);
                    const listingRow = listingProductByPrintifyId.get(p.id);
                    const heroSrc = listingRow
                      ? (productImageUrls(listingRow)[0] ?? catalogHero)
                      : catalogHero;
                    const listingUpdated = updatedAtByPrintifyId.get(p.id);
                    const updatedAtSource = listingUpdated ?? p.updatedAt;
                    const updatedParts = updatedAtSource
                      ? formatListingUpdatedParts(updatedAtSource)
                      : null;
                    const updatedCell =
                      updatedParts && updatedAtSource ? (
                      <span
                        className="inline-flex flex-col items-center gap-0.5 leading-tight text-zinc-400"
                        title={updatedAtSource.toISOString()}
                      >
                        <span>{updatedParts.date}</span>
                        <span>{updatedParts.time}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    );
                    return (
                      <tr key={p.id} className="border-t border-zinc-800/80">
                        <td className="p-2 align-middle">
                          {heroSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={heroSrc}
                              alt=""
                              className="h-10 w-10 rounded border border-zinc-700 object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded border border-zinc-800 bg-zinc-900/80 text-[10px] text-zinc-600"
                              aria-hidden
                            >
                              —
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-zinc-300">{p.title}</td>
                        <td className="p-2 text-center align-middle">
                          {updatedCell}
                        </td>
                        <td className="p-2 text-center align-middle whitespace-nowrap">
                          {productIdByPrintifyId.has(p.id) ? (
                            <Link
                              href={`/admin?tab=printify&listing=${encodeURIComponent(productIdByPrintifyId.get(p.id)!)}`}
                              className="inline-flex rounded border border-blue-900/50 bg-blue-950/30 px-2 py-1.5 text-[11px] font-medium text-blue-200/90 hover:bg-blue-950/50"
                            >
                              Edit
                            </Link>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="p-2 text-center align-middle whitespace-nowrap">
                          <form
                            className="inline-block"
                            action={resyncPrintifyCatalogProduct}
                          >
                            <input type="hidden" name="printifyProductId" value={p.id} />
                            <button
                              type="submit"
                              aria-label="Resync"
                              title="Resync"
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-emerald-900/60 bg-emerald-950/35 text-emerald-200/90 hover:bg-emerald-950/55"
                            >
                              <CatalogResyncIcon />
                            </button>
                          </form>
                        </td>
                        <td className="p-2 text-center align-middle whitespace-nowrap">
                          <form
                            className="inline-block"
                            action={notifyPrintifyPublishingSucceeded}
                          >
                            <input type="hidden" name="printifyProductId" value={p.id} />
                            <button
                              type="submit"
                              aria-label="Toggle published"
                              title="Toggle published"
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-600 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-700/60"
                            >
                              <CatalogTableAngleGlyph />
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
          Storefront listing
        </h3>
        <p className="mt-1 text-xs text-zinc-600">
          Sync fills Printify ids and variants. Checkout uses the variant chosen on the product page. One listing at a
          time — open it with <strong className="font-medium text-zinc-500">Edit</strong> in the catalog table.
        </p>
        {openListingId && !selectedListing ? (
          <p className="mt-4 rounded-lg border border-amber-900/40 bg-amber-950/25 px-4 py-3 text-sm text-amber-200/90">
            No listing matches this link. Use <strong className="font-medium text-amber-100/90">Edit</strong> from the
            catalog, or check the URL.
          </p>
        ) : null}
        {!openListingId && products.length > 0 ? (
          <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-500">
            Choose <strong className="font-medium text-zinc-400">Edit</strong> on a catalog row to open that storefront
            listing here.
          </p>
        ) : null}
        {selectedListing ? (
          <ul className="mt-4 space-y-6">
            <li className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3 text-xs text-zinc-500">
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
                  {productImageUrls(selectedListing)[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productImageUrls(selectedListing)[0]}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded border border-zinc-700 object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <span className="text-zinc-400">
                      {selectedListing.tags.map((x) => x.tag.name).join(" · ") ||
                        selectedListing.primaryTag?.name ||
                        "—"}
                    </span>
                    {" · "}
                    <Link
                      href={`/product/${selectedListing.slug}`}
                      className="text-blue-400/90 hover:underline"
                    >
                      /product/{selectedListing.slug}
                    </Link>
                    {selectedListing.active ? "" : " · inactive"}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <AdminProductPreviewButton
                    slug={selectedListing.slug}
                    productName={selectedListing.name}
                    disabled={!selectedListing.active}
                  />
                  <Link
                    href="/admin?tab=printify"
                    className="rounded border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                  >
                    Close
                  </Link>
                </div>
              </div>
              <SaveListingForm
                action={updateProductDetails.bind(null, selectedListing.id)}
                savedHighlight={listingSavedId === selectedListing.id}
              >
                <label className="block text-xs text-zinc-500">
                  Title
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={selectedListing.name}
                    className="mt-1 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Description
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={selectedListing.description ?? ""}
                    className="mt-1 block w-full max-w-2xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </label>
                <ProductTagFields
                  key={`printify-${selectedListing.id}-${productTagIds(selectedListing).join("-")}`}
                  tags={allTags}
                  defaultTagIds={productTagIds(selectedListing)}
                />
                <ProductDesignNameFields
                  key={`printify-design-${selectedListing.id}-${designNamesFromJson(selectedListing.designNames).join("|")}`}
                  knownNames={knownDesignNames}
                  defaultNames={designNamesFromJson(selectedListing.designNames)}
                />
                <CollectionAssignmentFields audience={selectedListing.audience} />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    name="checkoutTipEligible"
                    defaultChecked={selectedListing.checkoutTipEligible}
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
                      defaultChecked={selectedListing.payCard}
                      className="rounded border-zinc-600"
                    />
                    Card
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      name="payCashApp"
                      defaultChecked={selectedListing.payCashApp}
                      className="rounded border-zinc-600"
                    />
                    Cash App
                  </label>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Stripe only shows methods every line in the cart allows.
                </p>
                <ListingGalleryEditor
                  defaultUrls={productImageUrls(selectedListing)}
                  listingUploadVariant="printify"
                  printifyProductId={selectedListing.printifyProductId}
                />
                <div className="flex flex-wrap items-end gap-4">
                  <PrintifyListingPriceFields listing={selectedListing} />
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={selectedListing.active}
                      className="rounded border-zinc-600"
                    />
                    Visible in shop
                  </label>
                </div>
              </SaveListingForm>
            </li>
          </ul>
        ) : null}
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">No Printify products in the database.</p>
        ) : null}
      </section>
    </div>
  );
}
