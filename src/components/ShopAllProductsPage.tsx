import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStoreTags } from "@/lib/store-tags";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { ShopByItemAndDesignBrowse } from "@/components/ShopByItemAndDesignBrowse";
import {
  buildByDesignOnePerName,
  buildByItemOnePerTag,
} from "@/lib/shop-by-item-and-design";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";

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
  const byItemSections = buildByItemOnePerTag(allProducts, tags, {
    catalog: "all",
  });
  const byDesignSections = buildByDesignOnePerName(allProducts);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="store-dimension-page-title text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
            All products
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            One shop and one cart. Below: one product per tag (By Item) and per design
            name (By Design). Use{" "}
            <Link href="/shop/sub" className="text-blue-400/90 hover:underline">
              Sub collection
            </Link>{" "}
            or{" "}
            <Link href="/shop/domme" className="text-blue-400/90 hover:underline">
              Domme collection
            </Link>{" "}
            to narrow by audience, or the tag menu for full tag pages.
          </p>
        </div>
      </div>

      <FeaturedProductsCarousel
        items={productsToFeaturedCarouselItems(allProducts)}
        label="Featured products"
      />

      <ShopByItemAndDesignBrowse
        byItemSections={byItemSections}
        byDesignSections={byDesignSections}
        viewAllHrefForTag={(slug) => `/shop/tag/${slug}`}
        emptyMessage="No products yet. Add items in admin, assign tags, or sync from Printify. If you expected data already, the database for this deployment may be empty or not migrated (local data does not sync to production automatically)."
      />
    </div>
  );
}
