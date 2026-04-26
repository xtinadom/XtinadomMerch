import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreTagsForShop } from "@/lib/store-tags";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { ShopByItemAndDesignBrowse } from "@/components/ShopByItemAndDesignBrowse";
import { ShopPlatformBrowseGrid } from "@/components/ShopPlatformBrowseGrid";
import { buildByDesignOnePerName, buildByItemOnePerTag } from "@/lib/shop-by-item-and-design";
import { parseBrowseAllPageFeaturedProductIds } from "@/lib/browse-all-page-featured-product-ids";
import { getPlatformAllPageFeaturedProducts } from "@/lib/platform-all-page-featured";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { PLATFORM_SHOP_SLUG, shopUniversalTagHref } from "@/lib/marketplace-constants";
import {
  marketplaceAggregatedListingWhere,
  storefrontShopListingWhere,
} from "@/lib/shop-listing-storefront-visibility";

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
    select: { id: true },
  });
  if (!shop) notFound();

  /** Optional column from migration `20260225140000`; absent DBs skip admin picks until `migrate deploy`. */
  let adminFeaturedProductIds: string[] = [];
  if (shopSlug === PLATFORM_SHOP_SLUG) {
    try {
      const featuredRow = await prisma.shop.findUnique({
        where: { id: shop.id },
        select: { browseAllPageFeaturedProductIds: true },
      });
      adminFeaturedProductIds = parseBrowseAllPageFeaturedProductIds(
        featuredRow?.browseAllPageFeaturedProductIds ?? null,
      );
    } catch (e) {
      console.warn("[ShopAllProductsPage] browseAllPageFeaturedProductIds not available", e);
    }
  }

  const isPlatformCatalog = shopSlug === PLATFORM_SHOP_SLUG;
  const tags = isPlatformCatalog ? [] : await getStoreTagsForShop(shop.id);

  const listingWhere =
    shopSlug === PLATFORM_SHOP_SLUG
      ? { ...marketplaceAggregatedListingWhere, product: { active: true } }
      : { shopId: shop.id, ...storefrontShopListingWhere, product: { active: true } };

  let listings;
  try {
    listings = await prisma.shopListing.findMany({
      where: listingWhere,
      orderBy: { product: { name: "asc" } },
      include: {
        product: { include: productInclude },
        shop: { select: { slug: true, displayName: true } },
      },
    });
  } catch (e) {
    console.error("[ShopAllProductsPage] listings", e);
    return <ShopDataLoadError cause={e} />;
  }

  const allProducts = listings.map((l) => productCardProductFromListing(l));

  /**
   * Marketplace featured strip prefers admin order + 30-day sellers, but that pool can be tiny
   * while Browse lists many live listings — merge browse so the carousel can show 3+ tiles when
   * enough products have display images.
   */
  let featuredSourceProducts = allProducts;
  if (shopSlug === PLATFORM_SHOP_SLUG) {
    const primary = await getPlatformAllPageFeaturedProducts(adminFeaturedProductIds);
    const seen = new Set(primary.map((p) => p.id));
    const merged = [...primary];
    for (const p of allProducts) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    }
    featuredSourceProducts = merged;
  }
  const featuredCarouselItems = productsToFeaturedCarouselItems(featuredSourceProducts);
  const featuredDefaultListingShopSlug =
    shopSlug === PLATFORM_SHOP_SLUG ? undefined : shopSlug;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="store-dimension-page-title text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
            All products
          </h1>
        </div>
      </div>

      {featuredCarouselItems.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-2 text-center text-sm font-medium uppercase tracking-wide text-zinc-500">
            {isPlatformCatalog ? "Top sellers" : "Featured"}
          </h2>
          <FeaturedProductsCarousel
            items={featuredCarouselItems}
            hideKicker
            label={isPlatformCatalog ? "Top sellers" : "Featured products"}
            defaultListingShopSlug={featuredDefaultListingShopSlug}
          />
        </section>
      ) : null}

      <section className={isPlatformCatalog ? "mt-2" : undefined}>
        {isPlatformCatalog ? (
          <>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Browse</h2>
            <ShopPlatformBrowseGrid products={allProducts} />
          </>
        ) : (
          <ShopByItemAndDesignBrowse
            shopSlug={shopSlug}
            byItemSections={buildByItemOnePerTag(allProducts, tags)}
            byDesignSections={buildByDesignOnePerName(allProducts)}
            viewAllHrefForTag={(slug) => shopUniversalTagHref(shopSlug, slug)}
            emptyMessage="No products yet."
            limitPerSection={1}
          />
        )}
      </section>
    </div>
  );
}
