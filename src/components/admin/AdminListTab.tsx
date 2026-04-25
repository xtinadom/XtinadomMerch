import { prisma } from "@/lib/prisma";
import { AdminListAddItemForm } from "@/components/admin/AdminListAddItemForm";
import { AdminListItemsPanel } from "@/components/admin/AdminListItemsPanel";

export async function AdminListTab() {
  const [items, allTags] = await Promise.all([
    prisma.adminCatalogItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        catalogTags: {
          include: {
            tag: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
    prisma.tag.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const serializable = items.map((item) => ({
    id: item.id,
    name: item.name,
    itemPlatformProductId: item.itemPlatformProductId,
    itemExampleListingUrl: item.itemExampleListingUrl,
    itemMinPriceCents: item.itemMinPriceCents,
    itemGoodsServicesCostCents: item.itemGoodsServicesCostCents,
    itemImageRequirementLabel: item.itemImageRequirementLabel,
    itemMinArtworkLongEdgePx: item.itemMinArtworkLongEdgePx,
    tags: item.catalogTags.map((ct) => ({
      id: ct.tag.id,
      name: ct.tag.name,
      slug: ct.tag.slug,
    })),
  }));

  return (
    <section id="admin-baseline-list" aria-label="Admin list">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Admin list</h2>
      <p className="mt-1 max-w-2xl text-xs text-zinc-600">
        Baseline catalog of what shop owners may request: item name, optional example link, minimum list price,
        optional goods/services cost (fulfillment COGS per unit — retained by the platform before the marketplace
        fee), and optional tags. This list is not synced from Printify.
      </p>

      <div className="mt-6">
        <AdminListAddItemForm />
      </div>

      <div className="mt-8">
        <AdminListItemsPanel items={serializable} allTags={allTags} />
      </div>
    </section>
  );
}
