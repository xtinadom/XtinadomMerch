import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStoreTags } from "@/lib/store-tags";
import { buildShopSections } from "@/lib/shop-browse-sections";
import { ShopProductSectionList } from "@/components/ShopProductSectionList";

const productInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

export async function ShopAllProductsPage() {
  const tags = await getStoreTags();
  const allProducts = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: productInclude,
  });
  const sections = buildShopSections(allProducts, tags);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">All products</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            One shop and one cart. Use{" "}
            <Link href="/shop/sub" className="text-rose-400/90 hover:underline">
              Sub collection
            </Link>{" "}
            or{" "}
            <Link href="/shop/domme" className="text-rose-400/90 hover:underline">
              Domme collection
            </Link>{" "}
            to narrow by audience; tags describe product types and can apply across
            collections.
          </p>
        </div>
      </div>

      <ShopProductSectionList
        sections={sections}
        viewAllHrefForTag={(slug) => `/shop/tag/${slug}`}
        emptyMessage="No products yet. Add items in admin, assign tags, or sync from Printify."
      />
    </div>
  );
}
