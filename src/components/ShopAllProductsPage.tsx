import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
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

/** Optional browse filter: each whitespace-separated token must match product name, listing name, or keywords. */
function listingTextSearchWhere(query: string | undefined): Prisma.ShopListingWhereInput {
  const trimmed = query?.trim();
  if (!trimmed) return {};
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};
  const insensitive = "insensitive" as Prisma.QueryMode;
  return {
    AND: tokens.map((t) => ({
      OR: [
        { product: { name: { contains: t, mode: insensitive } } },
        { requestItemName: { contains: t, mode: insensitive } },
        { listingSearchKeywords: { contains: t, mode: insensitive } },
      ],
    })),
  };
}

export async function ShopAllProductsPage({
  shopSlug = PLATFORM_SHOP_SLUG,
  searchQuery,
}: {
  shopSlug?: string;
  /** From `?q=` on `/shop/all` or `/s/[shop]/all`. */
  searchQuery?: string;
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

  const listingWhereBase: Prisma.ShopListingWhereInput =
    shopSlug === PLATFORM_SHOP_SLUG
      ? { ...marketplaceAggregatedListingWhere, product: { active: true } }
      : { shopId: shop.id, ...storefrontShopListingWhere, product: { active: true } };

  const textWhere = listingTextSearchWhere(searchQuery);
  const listingWhere: Prisma.ShopListingWhereInput =
    Object.keys(textWhere).length === 0
      ? listingWhereBase
      : { AND: [listingWhereBase, textWhere] };

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
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="store-dimension-page-title text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
            All products
          </h1>
        </div>
        <form method="get" className="flex w-full max-w-md flex-wrap items-center gap-2 sm:justify-end">
          <label className="sr-only" htmlFor="shop-all-search-q">
            Search products
          </label>
          <input
            id="shop-all-search-q"
            name="q"
            type="search"
            defaultValue={searchQuery ?? ""}
            placeholder="Search name or keywords…"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            type="submit"
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            Search
          </button>
          {searchQuery?.trim() ? (
            <a href={shopSlug === PLATFORM_SHOP_SLUG ? "/shop/all" : `/s/${encodeURIComponent(shopSlug)}/all`} className="text-xs text-zinc-500 hover:text-zinc-300">
              Clear
            </a>
          ) : null}
        </form>
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
