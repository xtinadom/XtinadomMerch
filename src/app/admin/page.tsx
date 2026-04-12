import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import {
  createManualUsedProduct,
  deleteManualUsedProduct,
  logoutAdmin,
  submitManualStockForm,
  updateProductDetails,
} from "@/actions/admin";
import {
  adminCreateTagForm,
  adminDeleteTagForm,
  adminUpdateTagForm,
} from "@/actions/admin-tags";
import type { Prisma } from "@/generated/prisma/client";
import {
  Audience,
  FulfillmentType,
  ListingRequestStatus,
  OrderStatus,
} from "@/generated/prisma/enums";
import { productImageUrls } from "@/lib/product-media";
import { ConfirmDeleteForm } from "@/components/ConfirmDeleteForm";
import { CollectionAssignmentFields } from "@/components/admin/CollectionAssignmentFields";
import { ProductDesignNameFields } from "@/components/admin/ProductDesignNameFields";
import { ProductTagFields } from "@/components/admin/ProductTagFields";
import { productHasTag, productTagIds } from "@/lib/product-tags";
import { PrintifyApiTab } from "./printify-api-tab";
import { PrintifyInventoryTab } from "./printify-inventory-tab";
import { ListingGalleryEditor } from "@/components/admin/ListingGalleryEditor";
import { SaveListingForm } from "@/components/admin/SaveListingForm";
import {
  collectKnownDesignNamesFromProducts,
  designNamesFromJson,
} from "@/lib/product-design-names";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { AdminPlatformSalesTab } from "@/components/admin/AdminPlatformSalesTab";
import { AdminShopsMarketplaceTab } from "@/components/admin/AdminShopsMarketplaceTab";
import { AdminListingRequestsTab } from "@/components/admin/AdminListingRequestsTab";
import { AdminListTab } from "@/components/admin/AdminListTab";

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

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session.isAdmin) {
    redirect("/admin/login");
  }

  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const inventoryTabLiterals = [
    "manual",
    "printify",
    "admin-list",
    "orders",
    "sales",
    "shops",
    "requests",
    "printify-api",
    "tags",
  ] as const;
  type InventoryTab = (typeof inventoryTabLiterals)[number];
  const inventoryTab: InventoryTab = inventoryTabLiterals.includes(
    tabParam as InventoryTab,
  )
    ? (tabParam as InventoryTab)
    : "manual";

  const salesFromRaw = typeof sp.salesFrom === "string" ? sp.salesFrom : "";
  const salesToRaw = typeof sp.salesTo === "string" ? sp.salesTo : "";
  function parseIsoDateBoundary(s: string): Date | undefined {
    const t = s.trim();
    if (!t) return undefined;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const salesFrom = parseIsoDateBoundary(salesFromRaw);
  const salesTo = parseIsoDateBoundary(salesToRaw);
  const salesOrderCreatedAt =
    salesFrom || salesTo
      ? {
          ...(salesFrom ? { gte: salesFrom } : {}),
          ...(salesTo ? { lte: salesTo } : {}),
        }
      : undefined;
  const platformSalesWhere = {
    order: {
      status: OrderStatus.paid,
      ...(salesOrderCreatedAt ? { createdAt: salesOrderCreatedAt } : {}),
    },
  };
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
  const syncMode = typeof sp.syncMode === "string" ? sp.syncMode : undefined;
  const fullSyncAtRaw = typeof sp.fullSyncAt === "string" ? sp.fullSyncAt : undefined;
  const fullSyncAt =
    fullSyncAtRaw != null
      ? (() => {
          try {
            return decodeURIComponent(fullSyncAtRaw);
          } catch {
            return fullSyncAtRaw;
          }
        })()
      : undefined;
  const tagErr = typeof sp.tag_err === "string" ? sp.tag_err : undefined;
  const saved = typeof sp.saved === "string" ? sp.saved : undefined;
  const listingQueryId =
    typeof sp.listing === "string" ? sp.listing : undefined;
  const tagSaved = typeof sp.tag_saved === "string" ? sp.tag_saved : undefined;
  const savedTagId =
    typeof sp.saved_tag_id === "string" ? sp.saved_tag_id : undefined;
  const stockErr = typeof sp.stock_err === "string" ? sp.stock_err : undefined;
  const pfyHook = typeof sp.pfyHook === "string" ? sp.pfyHook : undefined;
  const pfyHookReason = typeof sp.pfyHookReason === "string" ? sp.pfyHookReason : undefined;
  const pfyHookDetail = typeof sp.pfyHookDetail === "string" ? sp.pfyHookDetail : undefined;
  const pub = typeof sp.pub === "string" ? sp.pub : undefined;
  const pubKind = typeof sp.pubKind === "string" ? sp.pubKind : undefined;
  const pubPid = typeof sp.pubPid === "string" ? sp.pubPid : undefined;
  const pubReason = typeof sp.pubReason === "string" ? sp.pubReason : undefined;
  const pubDetail = typeof sp.pubDetail === "string" ? sp.pubDetail : undefined;
  const r2Prune = typeof sp.r2Prune === "string" ? sp.r2Prune : undefined;
  const r2PruneReason =
    typeof sp.r2PruneReason === "string" ? sp.r2PruneReason : undefined;
  const r2Listed = typeof sp.r2Listed === "string" ? sp.r2Listed : undefined;
  const r2Ref = typeof sp.r2Ref === "string" ? sp.r2Ref : undefined;
  const r2Orphans = typeof sp.r2Orphans === "string" ? sp.r2Orphans : undefined;
  const r2Deleted = typeof sp.r2Deleted === "string" ? sp.r2Deleted : undefined;

  const printifyHookBanner =
    pfyHook === "ok"
      ? {
          variant: "ok" as const,
          text:
            pfyHookDetail === "already"
              ? "This storefront webhook is already registered with Printify."
              : "Registered the order webhook with Printify. They can POST events to your live URL.",
        }
      : pfyHook === "err"
        ? {
            variant: "err" as const,
            text:
              pfyHookReason === "no_shop"
                ? "Set PRINTIFY_SHOP_ID in the environment."
                : pfyHookReason === "no_secret"
                  ? "Set PRINTIFY_WEBHOOK_SECRET (at least 16 random characters) in the environment."
                  : pfyHookReason === "no_public_url"
                    ? "Set NEXT_PUBLIC_APP_URL to your live https origin (or deploy on Vercel so VERCEL_URL is available)."
                    : (() => {
                        try {
                          return decodeURIComponent(pfyHookReason ?? "Something went wrong.");
                        } catch {
                          return pfyHookReason ?? "Something went wrong.";
                        }
                      })(),
          }
        : undefined;

  const printifyPublishNotice =
    pub === "ok"
      ? {
          variant: "ok" as const,
          kind: pubKind === "failed" ? ("failed" as const) : ("succeeded" as const),
          productId: pubPid,
        }
      : pub === "err"
        ? {
            variant: "err" as const,
            reason: pubReason,
            productId: pubPid,
            detail: pubDetail
              ? (() => {
                  try {
                    return decodeURIComponent(pubDetail);
                  } catch {
                    return pubDetail;
                  }
                })()
              : undefined,
          }
        : undefined;

  const [
    products,
    orders,
    adminTags,
    platformSalesLines,
    marketplaceShops,
    listingRequestRows,
  ] = await Promise.all([
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
    prisma.orderLine.findMany({
      where: platformSalesWhere,
      orderBy: { order: { createdAt: "desc" } },
      take: 500,
      include: {
        order: { select: { id: true, createdAt: true } },
        shop: { select: { displayName: true, slug: true } },
      },
    }),
    prisma.shop.findMany({
      where: { slug: { not: PLATFORM_SHOP_SLUG } },
      orderBy: { displayName: "asc" },
      include: {
        listings: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            active: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
    prisma.shopListing.findMany({
      where: { requestStatus: ListingRequestStatus.submitted },
      orderBy: { updatedAt: "desc" },
      include: {
        shop: true,
        product: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  const manualProducts = products.filter((p) => p.fulfillmentType === FulfillmentType.manual);
  const printifyProducts = products.filter(
    (p) => p.fulfillmentType === FulfillmentType.printify,
  );

  const knownDesignNames = collectKnownDesignNamesFromProducts(products);

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

      {saved === "stock" ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
        >
          Stock updated.
        </p>
      ) : null}
      {stockErr ? (
        <p
          role="alert"
          className="rounded-lg border border-blue-900/50 bg-blue-950/30 px-4 py-2 text-sm text-blue-200/90"
        >
          {stockErr === "invalid"
            ? "Enter a valid whole number for stock."
            : "Could not update stock."}
        </p>
      ) : null}

      {products.length === 0 ? (
        <div
          role="status"
          className="rounded-lg border border-amber-900/45 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/90"
        >
          <p className="font-medium text-amber-50/95">No products in this database</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-200/85">
            Admin and the shop use the same PostgreSQL connection. If both look empty, this environment is
            almost certainly using a database with no product rows yet, or a different database than where you
            created data (for example only on your laptop, not on Vercel).
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs text-amber-200/80">
            <li>
              Confirm{" "}
              <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
                POSTGRES_PRISMA_URL
              </code>{" "}
              or{" "}
              <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
                DATABASE_URL
              </code>{" "}
              in this deployment (e.g. Vercel → Production) points at the database you intend.
            </li>
            <li>
              Run{" "}
              <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
                npx prisma migrate deploy
              </code>{" "}
              and{" "}
              <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
                npm run db:seed
              </code>{" "}
              from your machine using that same URL (see VERCEL.md).
            </li>
            <li>
              Or add listings here in this Admin (and sync Printify if you use it)—they are stored only in the
              database your env points to.
            </li>
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40">
        <nav
          className="flex flex-wrap gap-1 border-b border-zinc-800 px-2 pt-2"
          aria-label="Admin sections"
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
            Printify items
            <span className="ml-1.5 tabular-nums text-zinc-500">({printifyProducts.length})</span>
          </Link>
          <Link
            href="/admin?tab=admin-list"
            role="tab"
            aria-selected={inventoryTab === "admin-list"}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "admin-list"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Admin list
          </Link>
          <Link
            href="/admin?tab=orders"
            role="tab"
            aria-selected={inventoryTab === "orders"}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "orders"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Orders
            <span className="ml-1.5 tabular-nums text-zinc-500">({orders.length})</span>
          </Link>
          <Link
            href="/admin?tab=sales"
            role="tab"
            aria-selected={inventoryTab === "sales"}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "sales"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Platform sales
            <span className="ml-1.5 tabular-nums text-zinc-500">({platformSalesLines.length})</span>
          </Link>
          <Link
            href="/admin?tab=shops"
            role="tab"
            aria-selected={inventoryTab === "shops"}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "shops"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Shops
            <span className="ml-1.5 tabular-nums text-zinc-500">({marketplaceShops.length})</span>
          </Link>
          <Link
            href="/admin?tab=requests"
            role="tab"
            aria-selected={inventoryTab === "requests"}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "requests"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Requests
            <span className="ml-1.5 tabular-nums text-zinc-500">({listingRequestRows.length})</span>
          </Link>
          <Link
            href="/admin?tab=printify-api"
            role="tab"
            aria-selected={inventoryTab === "printify-api"}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "printify-api"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Printify API
          </Link>
          <Link
            href="/admin?tab=tags"
            role="tab"
            aria-selected={inventoryTab === "tags"}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "tags"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Tags
            <span className="ml-1.5 tabular-nums text-zinc-500">({adminTags.length})</span>
          </Link>
        </nav>

        <div className="p-4 pt-6 sm:p-6">
          {inventoryTab === "manual" ? (
            <section aria-label="Manual inventory">
              {createOk && (
                <p className="mb-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">
                  Used item created.
                </p>
              )}
              {createErr && (
                <p className="mb-4 rounded-lg border border-blue-900/50 bg-blue-950/30 px-4 py-2 text-sm text-blue-200/90">
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
                <p className="mb-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">
                  Used item deleted.
                </p>
              )}
              {deleteArchived && (
                <p className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90">
                  Item has order history — it was hidden from the shop (inactive) instead of being removed.
                </p>
              )}
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                Used items (manual fulfillment)
              </h2>
              <p className="mt-1 text-xs text-zinc-600">
                Shipped by you; stock is enforced at checkout. Add photos by URL or upload (see .env for
                Vercel Blob).
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
                  <ListingGalleryEditor defaultUrls={[]} />
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
                      Add tags in the Tags tab before creating used items.
                    </p>
                  )}
                  <ProductDesignNameFields knownNames={knownDesignNames} defaultNames={[]} />
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
                            className="text-blue-400/90 hover:underline"
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
                          className="rounded border border-blue-900/60 bg-blue-950/40 px-2 py-1 text-xs text-blue-300 hover:bg-blue-900/50"
                        >
                          Delete
                        </button>
                      </ConfirmDeleteForm>
                    </div>
                    <SaveListingForm
                      action={updateProductDetails.bind(null, p.id)}
                      savedHighlight={
                        saved === "product" && listingQueryId === p.id
                      }
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
                        key={`edit-${p.id}-${productTagIds(p).join("-")}`}
                        tags={adminTags}
                        defaultTagIds={productTagIds(p)}
                      />
                      <ProductDesignNameFields
                        key={`edit-design-${p.id}-${designNamesFromJson(p.designNames).join("|")}`}
                        knownNames={knownDesignNames}
                        defaultNames={designNamesFromJson(p.designNames)}
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
                      <ListingGalleryEditor defaultUrls={productImageUrls(p)} />
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
                      </div>
                    </SaveListingForm>
                    <div className="mt-4 border-t border-zinc-800 pt-4">
                      <form
                        action={submitManualStockForm.bind(null, p.id)}
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
          ) : inventoryTab === "printify" ? (
            <PrintifyInventoryTab
              products={printifyProducts}
              allTags={adminTags}
              sync={sync}
              syncMode={syncMode}
              fullSyncAtIso={fullSyncAt}
              syncUpdated={syncUpdated}
              syncCreated={syncCreated}
              syncSkipped={syncSkipped}
              syncRemoved={syncRemoved}
              syncReason={syncReason}
              openListingId={listingQueryId}
              listingSavedId={
                saved === "product" ? listingQueryId : undefined
              }
              publishNotice={printifyPublishNotice}
              r2PruneNotice={
                r2Prune === "preview" && r2Listed !== undefined
                  ? {
                      variant: "preview",
                      listed: parseInt(r2Listed, 10) || 0,
                      referenced: parseInt(r2Ref ?? "0", 10) || 0,
                      orphans: parseInt(r2Orphans ?? "0", 10) || 0,
                    }
                  : r2Prune === "ok" && r2Listed !== undefined
                    ? {
                        variant: "ok",
                        listed: parseInt(r2Listed, 10) || 0,
                        referenced: parseInt(r2Ref ?? "0", 10) || 0,
                        orphans: parseInt(r2Orphans ?? "0", 10) || 0,
                        deleted: parseInt(r2Deleted ?? "0", 10) || 0,
                      }
                    : r2Prune === "err"
                      ? {
                          variant: "err",
                          reason: r2PruneReason ?? "Unknown error.",
                        }
                      : undefined
              }
            />
          ) : inventoryTab === "orders" ? (
            <section aria-label="Recent orders">
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Recent orders</h2>
              <p className="mt-1 text-xs text-zinc-600">Latest 25 orders, newest first.</p>
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
              {orders.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">No orders yet.</p>
              ) : null}
            </section>
          ) : inventoryTab === "sales" ? (
            <AdminPlatformSalesTab
              lines={platformSalesLines}
              salesFromValue={salesFromRaw}
              salesToValue={salesToRaw}
            />
          ) : inventoryTab === "shops" ? (
            <AdminShopsMarketplaceTab
              shops={marketplaceShops}
              products={products.map((p) => ({
                id: p.id,
                name: p.name,
                minPriceCents: p.minPriceCents,
                priceCents: p.priceCents,
              }))}
              allProductsForAssign={products.map((p) => ({ id: p.id, name: p.name }))}
            />
          ) : inventoryTab === "requests" ? (
            <AdminListingRequestsTab
              rows={listingRequestRows}
              productOptions={products.map((p) => ({ id: p.id, name: p.name }))}
            />
          ) : inventoryTab === "printify-api" ? (
            <PrintifyApiTab hookBanner={printifyHookBanner} />
          ) : inventoryTab === "admin-list" ? (
            <AdminListTab />
          ) : (
            <section id="tags" aria-label="Shop tags">
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                Shop tags
              </h2>
              {tagSaved === "created" ||
              tagSaved === "updated" ||
              tagSaved === "deleted" ? (
                <p
                  role="status"
                  className="mt-2 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
                >
                  {tagSaved === "created"
                    ? "Tag created."
                    : tagSaved === "updated"
                      ? "Tag saved."
                      : "Tag deleted."}
                </p>
              ) : null}
              {tagErr ? (
                <p className="mt-2 rounded border border-blue-900/50 bg-blue-950/30 px-3 py-2 text-xs text-blue-200/90">
                  {tagErr}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-600">
                Tags are shared. Use{" "}
                <strong className="font-medium text-zinc-500">Collection assignment</strong> on each product
                to choose Sub collection, Domme collection, or both.
              </p>
              <ul className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
                {adminTags.map((t) => {
                  const subSpotlightSelectDefault =
                    t.subCollectionSpotlightProductId &&
                    products.some(
                      (p) =>
                        p.id === t.subCollectionSpotlightProductId &&
                        productHasTag(p, t.id) &&
                        (p.audience === Audience.sub ||
                          p.audience === Audience.both),
                    )
                      ? t.subCollectionSpotlightProductId
                      : "__auto__";
                  const dommeSpotlightSelectDefault =
                    t.dommeCollectionSpotlightProductId &&
                    products.some(
                      (p) =>
                        p.id === t.dommeCollectionSpotlightProductId &&
                        productHasTag(p, t.id) &&
                        (p.audience === Audience.domme ||
                          p.audience === Audience.both),
                    )
                      ? t.dommeCollectionSpotlightProductId
                      : "__auto__";
                  return (
                  <li
                    key={t.id}
                    className="flex flex-col gap-3 py-3 text-zinc-300 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
                  >
                    <form
                      action={adminUpdateTagForm}
                      className="flex min-w-0 flex-1 flex-col gap-2"
                    >
                      <input type="hidden" name="tagId" value={t.id} />
                      <div className="flex flex-wrap items-end gap-2">
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
                          className={
                            tagSaved === "updated" && savedTagId === t.id
                              ? "rounded border border-emerald-600/70 bg-emerald-950/45 px-2.5 py-1 text-[11px] font-medium text-emerald-100/95 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.2)]"
                              : "rounded border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
                          }
                          aria-label={
                            tagSaved === "updated" && savedTagId === t.id
                              ? "Tag saved"
                              : "Save tag"
                          }
                        >
                          {tagSaved === "updated" && savedTagId === t.id
                            ? "Saved"
                            : "Save"}
                        </button>
                      </div>
                      <div className="flex w-full min-w-0 max-w-full flex-col gap-1.5 sm:max-w-[min(100%,32rem)]">
                        <span className="text-[11px] text-zinc-500">
                          Top pick for collection
                        </span>
                        <div className="mt-0.5 flex flex-wrap items-end gap-2">
                          <label className="block min-w-0 text-[11px] text-zinc-500">
                            Sub collection
                            <select
                              name="subCollectionSpotlightProductId"
                              defaultValue={subSpotlightSelectDefault}
                              className="mt-0.5 block max-w-[11rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 sm:max-w-[13rem]"
                              title="Products with this tag that appear in the Sub shop (Sub or Both collection assignment)."
                            >
                              <option value="__auto__">Auto (first A–Z)</option>
                              {products
                                .filter(
                                  (p) =>
                                    productHasTag(p, t.id) &&
                                    (p.audience === Audience.sub ||
                                      p.audience === Audience.both),
                                )
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="block min-w-0 text-[11px] text-zinc-500">
                            Domme collection
                            <select
                              name="dommeCollectionSpotlightProductId"
                              defaultValue={dommeSpotlightSelectDefault}
                              className="mt-0.5 block max-w-[11rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 sm:max-w-[13rem]"
                              title="Products with this tag that appear in the Domme shop (Domme or Both collection assignment)."
                            >
                              <option value="__auto__">Auto (first A–Z)</option>
                              {products
                                .filter(
                                  (p) =>
                                    productHasTag(p, t.id) &&
                                    (p.audience === Audience.domme ||
                                      p.audience === Audience.both),
                                )
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </form>
                    <div className="flex shrink-0 items-center gap-3 sm:pb-0.5">
                      <ConfirmDeleteForm
                        action={adminDeleteTagForm}
                        message={`Delete tag “${t.name}”? Only if no products use it.`}
                      >
                        <input type="hidden" name="tagId" value={t.id} />
                        <button
                          type="submit"
                          className="text-[11px] text-blue-400/90 hover:underline"
                        >
                          Delete
                        </button>
                      </ConfirmDeleteForm>
                    </div>
                  </li>
                  );
                })}
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
          )}
        </div>
      </div>

      <Link href="/" className="text-xs text-zinc-600 hover:underline">
        ← Home
      </Link>
    </div>
  );
}
