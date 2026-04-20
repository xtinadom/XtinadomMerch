import { prisma } from "@/lib/prisma";
import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";
import { AdminListAddItemForm } from "@/components/admin/AdminListAddItemForm";
import { AdminListItemsPanel } from "@/components/admin/AdminListItemsPanel";

export async function AdminListTab() {
  const items = await prisma.adminCatalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const serializable = items.map((item) => ({
    id: item.id,
    name: item.name,
    variants: parseAdminCatalogVariantsJson(item.variants),
    itemPlatformProductId: item.itemPlatformProductId,
    itemExampleListingUrl: item.itemExampleListingUrl,
    itemMinPriceCents: item.itemMinPriceCents,
    itemGoodsServicesCostCents: item.itemGoodsServicesCostCents,
  }));

  return (
    <section id="admin-baseline-list" aria-label="Admin list">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Admin list</h2>
      <p className="mt-1 max-w-2xl text-xs text-zinc-600">
        Baseline catalog of what shop owners may request: item name, optional variants, optional example links,
        minimum prices, and optional goods/services cost (fulfillment COGS per unit — retained by the platform before
        the marketplace fee). This list is not synced from Printify.
      </p>

      <div className="mt-6">
        <AdminListAddItemForm />
      </div>

      <div className="mt-8">
        <AdminListItemsPanel items={serializable} />
      </div>
    </section>
  );
}
