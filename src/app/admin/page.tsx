import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import {
  createManualUsedProduct,
  deleteManualUsedProduct,
  logoutAdmin,
  updateManualStock,
  updateProductDetails,
} from "@/actions/admin";
import {
  adminCreateTagForm,
  adminDeleteTagForm,
  adminUpdateTagForm,
} from "@/actions/admin-tags";
import type { Prisma } from "@/generated/prisma/client";
import { FulfillmentType, OrderStatus } from "@/generated/prisma/enums";
import { productImageUrls } from "@/lib/product-media";
import { ConfirmDeleteForm } from "@/components/ConfirmDeleteForm";
import { CollectionAssignmentFields } from "@/components/admin/CollectionAssignmentFields";
import { ProductTagFields } from "@/components/admin/ProductTagFields";
import { productTagIds } from "@/lib/product-tags";
import { PrintifyInventoryTab } from "./printify-inventory-tab";

export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
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

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session.isAdmin) {
    redirect("/admin/login");
  }

  const sp = await searchParams;
  const inventoryTab = sp.tab === "printify" ? "printify" : "manual";
  const createOk = sp.create === "ok";
  const createErr = typeof sp.create === "string" && sp.create === "err";
  const createReason = typeof sp.reason === "string" ? sp.reason : undefined;
  const deleteOk = sp.delete === "ok";
  const deleteArchived = sp.delete === "archived";
  const sync = typeof sp.sync === "string" ? sp.sync : undefined;
  const syncUpdated = typeof sp.updated === "string" ? sp.updated : undefined;
  const syncCreated = typeof sp.created === "string" ? sp.created : undefined;
  const syncSkipped = typeof sp.skipped === "string" ? sp.skipped : undefined;
  const syncRemoved = typeof sp.removed === "string" ? sp.removed : undefined;
  const syncReason = typeof sp.reason === "string" ? sp.reason : undefined;
  const tagErr = typeof sp.tag_err === "string" ? sp.tag_err : undefined;

  const [products, orders, adminTags] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ name: "asc" }],
      include: {
        primaryTag: true,
        tags: { include: { tag: true } },
      },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        lines: true,
        fulfillmentJobs: true,
      },
    }),
    prisma.tag.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const manualProducts = products.filter((p) => p.fulfillmentType === FulfillmentType.manual);
  const printifyProducts = products.filter(
    (p) => p.fulfillmentType === FulfillmentType.printify,
  );

  const defaultCreateTagIds = adminTags[0] ? [adminTags[0].id] : [];

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Admin</h1>
        <div className="flex items-center gap-4">
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      <section id="tags" className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Shop tags
        </h2>
        {tagErr ? (
          <p className="mt-2 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-200/90">
            {tagErr}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-zinc-600">
          Tags are shared. Use <strong className="font-medium text-zinc-500">Collection assignment</strong>{" "}
          on each product to choose Sub shop, Domme shop, or both.
        </p>
        <ul className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
          {adminTags.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-3 py-3 text-zinc-300 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
            >
              <form
                action={adminUpdateTagForm}
                className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
              >
                <input type="hidden" name="tagId" value={t.id} />
                <label className="block text-[11px] text-zinc-500">
                  Name
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={t.name}
                    className="mt-0.5 block w-36 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 sm:w-40"
                  />
                </label>
                <label className="block text-[11px] text-zinc-500">
                  Slug
                  <input
                    type="text"
                    name="slug"
                    defaultValue={t.slug}
                    className="mt-0.5 block w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 sm:w-36"
                  />
                </label>
                <label className="block text-[11px] text-zinc-500">
                  Sort
                  <input
                    type="number"
                    name="sortOrder"
                    defaultValue={t.sortOrder}
                    className="mt-0.5 block w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
                >
                  Save
                </button>
              </form>
              <div className="flex shrink-0 items-center gap-3 sm:pb-0.5">
                <ConfirmDeleteForm
                  action={adminDeleteTagForm}
                  message={`Delete tag “${t.name}”? Only if no products use it.`}
                >
                  <input type="hidden" name="tagId" value={t.id} />
                  <button
                    type="submit"
                    className="text-[11px] text-rose-400/90 hover:underline"
                  >
                    Delete
                  </button>
                </ConfirmDeleteForm>
              </div>
            </li>
          ))}
        </ul>
        {adminTags.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No tags — run db seed.</p>
        ) : null}
        <form
          action={adminCreateTagForm}
          className="mt-6 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="block text-xs text-zinc-500">
            Name
            <input
              type="text"
              name="name"
              required
              className="mt-1 block w-40 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Slug (optional)
            <input
              type="text"
              name="slug"
              className="mt-1 block w-36 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Sort
            <input
              type="number"
              name="sortOrder"
              defaultValue={99}
              className="mt-1 block w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700"
          >
            Add tag
          </button>
        </form>
      </section>

      {createOk && (
        <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">
          Used item created.
        </p>
      )}
      {createErr && (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-2 text-sm text-rose-200/90">
          Could not create item
          {createReason === "category"
            ? " — pick at least one tag."
            : createReason === "collection"
              ? " — choose at least one shop (Sub and/or Domme)."
              : createReason === "name"
                ? " — title is required."
                : createReason === "price"
                  ? " — invalid price."
                  : "."}
        </p>
      )}
      {deleteOk && (
        <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">
          Used item deleted.
        </p>
      )}
      {deleteArchived && (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90">
          Item has order history — it was hidden from the shop (inactive) instead of being removed.
        </p>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40">
        <nav
          className="flex flex-wrap gap-1 border-b border-zinc-800 px-2 pt-2"
          aria-label="Inventory lists"
        >
          <Link
            href="/admin?tab=manual"
            role="tab"
            aria-selected={inventoryTab === "manual"}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "manual"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Manual items
            <span className="ml-1.5 tabular-nums text-zinc-500">({manualProducts.length})</span>
          </Link>
          <Link
            href="/admin?tab=printify"
            role="tab"
            aria-selected={inventoryTab === "printify"}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "printify"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Printify
            <span className="ml-1.5 tabular-nums text-zinc-500">({printifyProducts.length})</span>
          </Link>
        </nav>

        <div className="p-4 pt-6 sm:p-6">
          {inventoryTab === "manual" ? (
            <section aria-label="Manual inventory">
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                Used items (manual fulfillment)
              </h2>
              <p className="mt-1 text-xs text-zinc-600">
                Shipped by you; stock is enforced at checkout. Photo URLs must be https — one per line.
                Payment options apply to carts that include this item together with others (Stripe shows the
                intersection of what every line allows).
              </p>

              <div className="mt-6 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30 p-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Add used item</h3>
                <form action={createManualUsedProduct} className="mt-3 space-y-3">
                  <label className="block text-xs text-zinc-500">
                    Title
                    <input
                      type="text"
                      name="name"
                      required
                      className="mt-1 block w-full max-w-md rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                    />
                  </label>
                  <label className="block text-xs text-zinc-500">
                    Description
                    <textarea
                      name="description"
                      rows={3}
                      className="mt-1 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
                    />
                  </label>
                  <div className="flex flex-wrap gap-4">
                    <label className="block text-xs text-zinc-500">
                      Price (USD)
                      <input
                        type="number"
                        name="price"
                        required
                        min={0}
                        step={0.01}
                        className="mt-1 block w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm"
                      />
                    </label>
                    <label className="block text-xs text-zinc-500">
                      Initial stock
                      <input
                        type="number"
                        name="stock"
                        min={0}
                        defaultValue={0}
                        className="mt-1 block w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                  <label className="block text-xs text-zinc-500">
                    Photo URLs (one per line, https)
                    <textarea
                      name="gallery"
                      rows={3}
                      placeholder="https://…"
                      className="mt-1 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-300"
                    />
                  </label>
                  <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" name="payCard" defaultChecked className="rounded border-zinc-600" />
                      Card
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        name="payCashApp"
                        defaultChecked
                        className="rounded border-zinc-600"
                      />
                      Cash App
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        name="checkoutTipEligible"
                        defaultChecked
                        className="rounded border-zinc-600"
                      />
                      Allow checkout tip (sub shop)
                    </label>
                  </div>
                  <CollectionAssignmentFields />
                  {adminTags.length > 0 ? (
                    <ProductTagFields
                      key="create-manual-used"
                      tags={adminTags}
                      defaultTagIds={defaultCreateTagIds}
                    />
                  ) : (
                    <p className="text-xs text-amber-400/90">
                      Add tags in Shop tags above before creating used items.
                    </p>
                  )}
                  <button
                    type="submit"
                    className="rounded bg-emerald-900/80 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800/80"
                  >
                    Add used item
                  </button>
                </form>
              </div>

              <ul className="mt-6 space-y-6">
                {manualProducts.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/20 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-start gap-3">
                        {productImageUrls(p)[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={productImageUrls(p)[0]}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded border border-zinc-700 object-cover"
                          />
                        ) : null}
                        <div className="text-xs text-zinc-500">
                          <span className="text-zinc-400">
                            {p.tags.map((x) => x.tag.name).join(" · ")}
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
                      <ConfirmDeleteForm
                        action={deleteManualUsedProduct.bind(null, p.id)}
                        message={`Delete “${p.name}”? This cannot be undone.`}
                      >
                        <button
                          type="submit"
                          className="rounded border border-rose-900/60 bg-rose-950/40 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/50"
                        >
                          Delete
                        </button>
                      </ConfirmDeleteForm>
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
                        key={`edit-${p.id}-${productTagIds(p).join("-")}`}
                        tags={adminTags}
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
                        Allow checkout tip (sub shop)
                      </label>
                      <label className="block text-xs text-zinc-500">
                        Photo URLs (one per line, https)
                        <textarea
                          name="gallery"
                          rows={4}
                          defaultValue={galleryTextareaDefault(p)}
                          className="mt-1 block w-full max-w-2xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-300"
                        />
                      </label>
                      <div className="flex flex-wrap items-end gap-4">
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
                        <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
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
                        <button
                          type="submit"
                          className="rounded bg-rose-900/80 px-3 py-2 text-xs font-medium text-rose-100 hover:bg-rose-800/80"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                    <div className="mt-4 border-t border-zinc-800 pt-4">
                      <form
                        action={async (fd) => {
                          "use server";
                          const q = parseInt(String(fd.get("stock")), 10);
                          if (Number.isFinite(q)) await updateManualStock(p.id, q);
                        }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <label className="text-xs text-zinc-500">
                          Stock qty
                          <input
                            type="number"
                            name="stock"
                            min={0}
                            defaultValue={p.stockQuantity}
                            className="ml-2 w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                          />
                        </label>
                        <button
                          type="submit"
                          className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
                        >
                          Update stock
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
              {manualProducts.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">No used items yet — add one above.</p>
              ) : null}
            </section>
          ) : (
            <PrintifyInventoryTab
              products={printifyProducts}
              allTags={adminTags}
              sync={sync}
              syncUpdated={syncUpdated}
              syncCreated={syncCreated}
              syncSkipped={syncSkipped}
              syncRemoved={syncRemoved}
              syncReason={syncReason}
            />
          )}
        </div>
      </div>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Recent orders</h2>
        <ul className="mt-4 space-y-3">
          {orders.map((o) => (
            <li
              key={o.id}
              className="rounded-lg border border-zinc-800 p-4 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-zinc-500">{o.id.slice(0, 12)}…</span>
                <span
                  className={
                    o.status === OrderStatus.paid
                      ? "text-emerald-400"
                      : o.status === OrderStatus.pending_payment
                        ? "text-amber-400"
                        : "text-zinc-500"
                  }
                >
                  {o.status}
                </span>
              </div>
              <p className="mt-1 text-zinc-300">
                {formatPrice(o.totalCents)} · tip {formatPrice(o.tipCents)} ·{" "}
                {o.email ?? "no email"}
              </p>
              <ul className="mt-2 text-xs text-zinc-500">
                {o.lines.map((l) => (
                  <li key={l.id}>
                    {l.productName} × {l.quantity} ({l.fulfillmentType})
                  </li>
                ))}
              </ul>
              {o.fulfillmentJobs.length > 0 && (
                <ul className="mt-2 border-t border-zinc-800 pt-2 text-xs text-zinc-600">
                  {o.fulfillmentJobs.map((j) => (
                    <li key={j.id}>
                      {j.provider}: {j.status}
                      {j.externalId ? ` · ${j.externalId}` : ""}
                      {j.lastError ? ` — ${j.lastError}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Link href="/" className="text-xs text-zinc-600 hover:underline">
        ← Home
      </Link>
    </div>
  );
}
