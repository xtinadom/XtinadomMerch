import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreTags, getStoreTagsForShop } from "@/lib/store-tags";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { ShopByItemAndDesignBrowse } from "@/components/ShopByItemAndDesignBrowse";
import {
  buildByDesignOnePerName,
  buildByItemOnePerTag,
} from "@/lib/shop-by-item-and-design";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import {
  PLATFORM_SHOP_SLUG,
  shopDommeHref,
  shopSubHref,
  shopUniversalTagHref,
} from "@/lib/marketplace-constants";

const productInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

export async function ShopAllProductsPage({
  shopSlug = PLATFORM_SHOP_SLUG,
}: {
  shopSlug?: string;
} = {}) {
  const shop = await prisma.shop.findFirst({
    where: { slug: shopSlug, active: true },
  });
  if (!shop) notFound();

  const tags =
    shopSlug === PLATFORM_SHOP_SLUG
      ? await getStoreTags()
      : await getStoreTagsForShop(shop.id);

  let listings;
  try {
    listings = await prisma.shopListing.findMany({
      where: { shopId: shop.id, active: true, product: { active: true } },
      orderBy: { product: { name: "asc" } },
      include: { product: { include: productInclude } },
    });
  } catch (e) {
    console.error("[ShopAllProductsPage] listings", e);
    return <ShopDataLoadError cause={e} />;
  }

  const allProducts = listings.map((l) => productCardProductFromListing(l));

  const byItemSections = buildByItemOnePerTag(allProducts, tags, {
    catalog: "all",
  });
  const byDesignSections = buildByDesignOnePerName(allProducts);

  const subHref = shopSubHref(shopSlug);
  const dommeHref = shopDommeHref(shopSlug);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="store-dimension-page-title text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
            All products
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            One shop and one cart. Below: one product per tag (By Item) and per design name (By
            Design). Use{" "}
            <Link href={subHref} className="text-blue-400/90 hover:underline">
              Sub collection
            </Link>{" "}
            or{" "}
            <Link href={dommeHref} className="text-blue-400/90 hover:underline">
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
        shopSlug={shopSlug}
        byItemSections={byItemSections}
        byDesignSections={byDesignSections}
        viewAllHrefForTag={(slug) => shopUniversalTagHref(shopSlug, slug)}
        emptyMessage="No products yet. Add items in admin, assign tags, or sync from Printify. If you expected data already, the database for this deployment may be empty or not migrated (local data does not sync to production automatically)."
      />
    </div>
  );
}
