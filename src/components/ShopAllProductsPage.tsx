import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import {
  ShopAllBrowseToolbar,
  type ShopAllBrowseSortParam,
} from "@/components/ShopAllBrowseToolbar";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { ShopPlatformBrowseGrid } from "@/components/ShopPlatformBrowseGrid";
import { getStoreTags, getStoreTagsForShop } from "@/lib/store-tags";
import { getPlatformAllPageFeaturedProducts } from "@/lib/platform-all-page-featured";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  marketplaceAggregatedListingWhere,
  storefrontShopListingWhere,
} from "@/lib/shop-listing-storefront-visibility";
import {
  shopListingPopularItemPromotionPurchasesArgs,
  sortShopListingsForPopularBrowse,
} from "@/lib/shop-listing-browse-promotion-sort";

const productInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

/** Optional browse filter: each whitespace-separated token must match product name, listing name, or keywords. */
function withProductTagFilter(
  listingWhere: Prisma.ShopListingWhereInput,
  tagSlug: string,
): Prisma.ShopListingWhereInput {
  const t = tagSlug.trim();
  const tagProduct: Prisma.ProductWhereInput = {
    OR: [
      { primaryTag: { slug: t } },
      { tags: { some: { tag: { slug: t } } } },
    ],
  };
  const inner = listingWhere as { product?: Prisma.ProductWhereInput };
  if (!inner.product) {
    return { ...listingWhere, product: tagProduct };
  }
  return {
    ...listingWhere,
    product: {
      AND: [inner.product, tagProduct],
    },
  };
}

function parseShopAllBrowseSort(
  raw: string | undefined | null,
): ShopAllBrowseSortParam {
  if (raw === "popular" || raw === "new") return raw;
  if (raw === "name") return "price";
  if (raw === "price") return "price";
  return "price";
}

/**
 * Prisma `orderBy` for browse — **Popular** is sorted in memory
 * (`sortShopListingsForPopularBrowse`); do not pass an order for that mode.
 */
function shopListingBrowsePrismaOrderBy(
  sort: ShopAllBrowseSortParam,
): Prisma.ShopListingOrderByWithRelationInput[] | undefined {
  switch (sort) {
    case "popular":
      return undefined;
    case "new":
      return [{ createdAt: "desc" }];
    case "price":
      return [{ priceCents: "asc" }, { product: { name: "asc" } }];
  }
}

const listingOrderNameAsc: Prisma.ShopListingOrderByWithRelationInput[] = [
  { product: { name: "asc" } },
];

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
  browseFlat = false,
  tagSlug,
  browseSort: browseSortParam,
}: {
  shopSlug?: string;
  /** From `?q=` on `/shop/all` or `/s/[shop]/all`. */
  searchQuery?: string;
  /** From `?flat=1` on `/s/[shop]/all` — single flat grid instead of tag sections. */
  browseFlat?: boolean;
  /** From `?tag=` — primary or secondary tag slug; filters Browse grid only. */
  tagSlug?: string | null;
  /**
   * From `?sort=`: `new` (listing `createdAt` desc), `price` (low → high), `popular` (newest paid
   * “Popular item” promotion, then line revenue, then product views), or default `price`. Legacy
   * `?sort=name` maps to `price`.
   */
  browseSort?: string | null;
} = {}) {
  const shop = await prisma.shop.findFirst({
    where: { slug: shopSlug, active: true },
    select: { id: true },
  });
  if (!shop) notFound();

  const isPlatformCatalog = shopSlug === PLATFORM_SHOP_SLUG;
  const browseSort = parseShopAllBrowseSort(browseSortParam);
  const browsePrismaOrderBy = shopListingBrowsePrismaOrderBy(browseSort);

  const filterTags =
    browseFlat && !isPlatformCatalog
      ? await getStoreTagsForShop(shop.id)
      : await getStoreTags();

  const textWhere = listingTextSearchWhere(searchQuery);
  const marketplaceWhereBase: Prisma.ShopListingWhereInput = {
    ...marketplaceAggregatedListingWhere,
    product: { active: true },
  };
  const shopWhereBase: Prisma.ShopListingWhereInput = {
    shopId: shop.id,
    ...storefrontShopListingWhere,
    product: { active: true },
  };

  function withSearch(
    base: Prisma.ShopListingWhereInput,
  ): Prisma.ShopListingWhereInput {
    return Object.keys(textWhere).length === 0 ? base : { AND: [base, textWhere] };
  }

  const listingIncludeBase = {
    product: { include: productInclude },
    shop: { select: { slug: true, displayName: true } },
  } as const;

  const listingInclude =
    browseSort === "popular"
      ? {
          ...listingIncludeBase,
          promotionPurchases: shopListingPopularItemPromotionPurchasesArgs,
        }
      : listingIncludeBase;

  let browseProducts: ReturnType<typeof productCardProductFromListing>[];
  let featuredSourceProducts: ReturnType<typeof productCardProductFromListing>[];

  const activeTag =
    tagSlug?.trim() &&
    filterTags.some((t) => t.slug === tagSlug.trim())
      ? tagSlug.trim()
      : undefined;

  try {
    if (isPlatformCatalog) {
      const fullWhere = withSearch(marketplaceWhereBase);
      const browseWhere =
        activeTag != null ? withProductTagFilter(fullWhere, activeTag) : fullWhere;

      if (activeTag != null) {
        const [browseRowsRaw, fullRows] = await Promise.all([
          prisma.shopListing.findMany({
            where: browseWhere,
            ...(browsePrismaOrderBy ? { orderBy: browsePrismaOrderBy } : {}),
            include: listingInclude,
          }),
          prisma.shopListing.findMany({
            where: fullWhere,
            orderBy: listingOrderNameAsc,
            include: listingIncludeBase,
          }),
        ]);
        const browseRows =
          browseSort === "popular"
            ? await sortShopListingsForPopularBrowse(browseRowsRaw)
            : browseRowsRaw;
        browseProducts = browseRows.map((l) => productCardProductFromListing(l));
        const pool = fullRows.map((l) => productCardProductFromListing(l));
        const primary = await getPlatformAllPageFeaturedProducts();
        const seen = new Set(primary.map((p) => p.id));
        const merged = [...primary];
        for (const p of pool) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            merged.push(p);
          }
        }
        featuredSourceProducts = merged;
      } else {
        const listingsRaw = await prisma.shopListing.findMany({
          where: browseWhere,
          ...(browsePrismaOrderBy ? { orderBy: browsePrismaOrderBy } : {}),
          include: listingInclude,
        });
        const listings =
          browseSort === "popular"
            ? await sortShopListingsForPopularBrowse(listingsRaw)
            : listingsRaw;
        const allProducts = listings.map((l) => productCardProductFromListing(l));
        browseProducts = allProducts;
        const primary = await getPlatformAllPageFeaturedProducts();
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
    } else if (browseFlat) {
      const base = withSearch(shopWhereBase);
      const where =
        activeTag != null ? withProductTagFilter(base, activeTag) : base;
      const listingsRaw = await prisma.shopListing.findMany({
        where,
        ...(browsePrismaOrderBy ? { orderBy: browsePrismaOrderBy } : {}),
        include: listingInclude,
      });
      const listings =
        browseSort === "popular"
          ? await sortShopListingsForPopularBrowse(listingsRaw)
          : listingsRaw;
      const shopProducts = listings.map((l) => productCardProductFromListing(l));
      browseProducts = shopProducts;
      featuredSourceProducts = shopProducts;
    } else {
      const shopListings = await prisma.shopListing.findMany({
        where: withSearch(shopWhereBase),
        orderBy: listingOrderNameAsc,
        include: listingIncludeBase,
      });
      const shopProducts = shopListings.map((l) => productCardProductFromListing(l));
      featuredSourceProducts = shopProducts;

      const mBase = withSearch(marketplaceWhereBase);
      const mWhere =
        activeTag != null ? withProductTagFilter(mBase, activeTag) : mBase;
      const marketplaceListingsRaw = await prisma.shopListing.findMany({
        where: mWhere,
        ...(browsePrismaOrderBy ? { orderBy: browsePrismaOrderBy } : {}),
        include: listingInclude,
      });
      const marketplaceListings =
        browseSort === "popular"
          ? await sortShopListingsForPopularBrowse(marketplaceListingsRaw)
          : marketplaceListingsRaw;
      browseProducts = marketplaceListings.map((l) => productCardProductFromListing(l));
    }
  } catch (e) {
    console.error("[ShopAllProductsPage] listings", e);
    return <ShopDataLoadError cause={e} />;
  }
  const featuredCarouselItems = productsToFeaturedCarouselItems(featuredSourceProducts);
  const featuredDefaultListingShopSlug =
    shopSlug === PLATFORM_SHOP_SLUG ? undefined : shopSlug;

  const toolbarTags = filterTags.map((t) => ({ slug: t.slug, name: t.name }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="store-dimension-page-title text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
          All Items
        </h1>
      </div>

      {featuredCarouselItems.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-2 text-center text-sm font-medium uppercase tracking-wide text-zinc-500">
            {isPlatformCatalog ? "Hot items" : "Featured"}
          </h2>
          <FeaturedProductsCarousel
            items={featuredCarouselItems}
            label={isPlatformCatalog ? "Hot items" : "Featured products"}
            defaultListingShopSlug={featuredDefaultListingShopSlug}
          />
        </section>
      ) : null}

      <section className={isPlatformCatalog ? "mt-2" : undefined}>
        <ShopAllBrowseToolbar
          shopSlug={shopSlug}
          tags={toolbarTags}
          selectedTagSlug={activeTag}
          selectedSort={browseSort}
          searchQuery={searchQuery}
          browseFlat={!isPlatformCatalog && browseFlat}
        />
        <ShopPlatformBrowseGrid
          shopSlug={!isPlatformCatalog && browseFlat ? shopSlug : undefined}
          showShopName={
            isPlatformCatalog ? true : browseFlat ? false : true
          }
          products={browseProducts}
          emptyState={
            searchQuery?.trim() ? (
              <p className="mt-8 text-sm text-zinc-600">
                No products match your search. Try different keywords or clear the search box above.
              </p>
            ) : isPlatformCatalog ? (
              <div className="mt-8 space-y-2 text-sm text-zinc-600">
                <p>No marketplace listings to show.</p>
                <p className="text-zinc-500">
                  Browse here includes only creator shops (not the platform catalog shop), an active
                  shop row, active catalog products, and storefront-visible listings. Dashboard “Live”
                  ignores shop and product activation—if you see live listings there but nothing here,
                  confirm the shop is active (shop deactivation or account deletion hides the whole
                  storefront) and products are active.
                </p>
              </div>
            ) : (
              <p className="mt-8 text-sm text-zinc-600">
                {browseFlat ? "No products in this shop yet." : "No marketplace listings to show."}
              </p>
            )
          }
        />
      </section>
    </div>
  );
}
