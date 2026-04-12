import { FulfillmentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";
import { AdminListAddItemForm } from "@/components/admin/AdminListAddItemForm";
import { AdminListItemsPanel } from "@/components/admin/AdminListItemsPanel";

export async function AdminListTab() {
  const [items, printifyProducts] = await Promise.all([
    prisma.adminCatalogItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.product.findMany({
      where: { active: true, fulfillmentType: FulfillmentType.printify },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializable = items.map((item) => ({
    id: item.id,
    name: item.name,
    variants: parseAdminCatalogVariantsJson(item.variants),
    itemPlatformProductId: item.itemPlatformProductId,
    itemExampleListingUrl: item.itemExampleListingUrl,
    itemMinPriceCents: item.itemMinPriceCents,
  }));

  return (
    <section aria-label="Admin list">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Admin list</h2>
      <p className="mt-1 max-w-2xl text-xs text-zinc-600">
        Manual reference catalog for internal use. Add rows below; the table is not synced from Printify.
      </p>

      <div className="mt-6">
        <AdminListAddItemForm printifyProducts={printifyProducts} />
      </div>

      <div className="mt-8">
        <AdminListItemsPanel items={serializable} printifyProducts={printifyProducts} />
      </div>
    </section>
  );
}
