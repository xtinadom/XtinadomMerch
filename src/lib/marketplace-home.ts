import { prisma } from "@/lib/prisma";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";
import { OrderStatus } from "@/generated/prisma/enums";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import type { ProductCardProduct } from "@/components/ProductCard";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { sortShopsForBrowse } from "@/lib/shops-browse";
import { HOME_HOT_CAROUSEL_LIMIT } from "@/lib/platform-all-page-featured-constants";
import { parseShopOrderedFeaturedProductIds } from "@/lib/shop-ordered-featured-product-ids";

const TOP_SHOPS_HOME_DEFAULT = 10;
const TOP_SHOPS_HOME_FETCH_CAP = 250;

const HOT_WINDOW_DAYS = 30;

const homeHotCarouselProductInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

/** Shops with a home featured listing + profile, for the platform home carousel. */
export async function getFeaturedCreatorShopsForHome() {
  return prisma.shop.findMany({
    where: {
      active: true,
      slug: { not: PLATFORM_SHOP_SLUG },
      homeFeaturedListing: {
        is: {
          active: true,
          creatorRemovedFromShopAt: null,
          product: { active: true },
        },
      },
    },
    include: {
      homeFeaturedListing: {
        include: {
          product: {
            include: {
              primaryTag: true,
              tags: { include: { tag: true } },
            },
          },
        },
      },
    },
    orderBy: [{ editorialPriority: "desc" }, { totalSalesCents: "desc" }],
    take: 8,
  });
}

/**
 * Creator shops for the home “Top shops” strip: same ranking as /shops default (editorial pin,
 * `editorialPriority`, then `totalSalesCents`). Admins influence order via those fields (+ paid
 * promos later can reuse `editorialPriority`).
 */
export async function getTopShopsForHome(limit = TOP_SHOPS_HOME_DEFAULT) {
  const raw = await prisma.shop.findMany({
    where: {
      active: true,
      slug: { not: PLATFORM_SHOP_SLUG },
    },
    select: {
      id: true,
      slug: true,
      displayName: true,
      profileImageUrl: true,
      bio: true,
      totalSalesCents: true,
      editorialPriority: true,
      editorialPinnedUntil: true,
      createdAt: true,
    },
    take: TOP_SHOPS_HOME_FETCH_CAP,
  });
  const sorted = sortShopsForBrowse(raw, "editorial");
  return sorted.slice(0, limit);
}

/**
 * Marketing home “Hot items” carousel: up to `limit` products. Admin-ordered picks on the platform
 * shop (`homeHotCarouselFeaturedProductIds`), then highest `storefrontViewCount`, then any live
 * marketplace listing.
 */
export async function getHomeHotCarouselProducts(
  limit = HOME_HOT_CAROUSEL_LIMIT,
): Promise<ProductCardProduct[]> {
  const platform = await prisma.shop.findUnique({
    where: { slug: PLATFORM_SHOP_SLUG },
    select: { homeHotCarouselFeaturedProductIds: true },
  });
  const adminIds = parseShopOrderedFeaturedProductIds(
    platform?.homeHotCarouselFeaturedProductIds ?? null,
  ).slice(0, limit);
  const used = new Set<string>();
  const out: ProductCardProduct[] = [];

  if (adminIds.length > 0) {
    const rows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        productId: { in: adminIds },
        product: { active: true },
      },
      orderBy: { createdAt: "asc" },
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    const byPid = new Map<string, (typeof rows)[0]>();
    for (const r of rows) {
      if (!byPid.has(r.productId)) byPid.set(r.productId, r);
    }
    for (const pid of adminIds) {
      const row = byPid.get(pid);
      if (row) {
        out.push(productCardProductFromListing(row));
        used.add(pid);
      }
      if (out.length >= limit) return out;
    }
  }

  const needViews = limit - out.length;
  if (needViews > 0) {
    const exclude = [...used];
    const viewedRows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        product: {
          active: true,
          ...(exclude.length > 0 ? { id: { notIn: exclude } } : {}),
        },
      },
      orderBy: { product: { storefrontViewCount: "desc" } },
      take: needViews + 80,
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    for (const row of viewedRows) {
      if (out.length >= limit) break;
      if (used.has(row.productId)) continue;
      used.add(row.productId);
      out.push(productCardProductFromListing(row));
    }
  }

  const needAny = limit - out.length;
  if (needAny > 0) {
    const exclude = [...used];
    const anyRows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        product: {
          active: true,
          ...(exclude.length > 0 ? { id: { notIn: exclude } } : {}),
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: needAny + 100,
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    for (const row of anyRows) {
      if (out.length >= limit) break;
      if (used.has(row.productId)) continue;
      used.add(row.productId);
      out.push(productCardProductFromListing(row));
    }
  }

  return out;
}

/** Top-selling products (by paid order line quantity) in the last window; creator live listings. */
export async function getHotListingProductsForHome(
  limit = 10,
): Promise<ProductCardProduct[]> {
  const since = new Date(Date.now() - HOT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const grouped = await prisma.orderLine.groupBy({
    by: ["productId"],
    where: {
      order: { status: OrderStatus.paid, createdAt: { gte: since } },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const ids = grouped.map((g) => g.productId);
  const listings = await prisma.shopListing.findMany({
    where: {
      ...marketplaceAggregatedListingWhere,
      productId: { in: ids },
      product: { active: true },
    },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        include: { primaryTag: true, tags: { include: { tag: true } } },
      },
      shop: { select: { slug: true } },
    },
  });
  const byProduct = new Map<string, (typeof listings)[0]>();
  for (const l of listings) {
    if (!byProduct.has(l.productId)) byProduct.set(l.productId, l);
  }
  const out: ProductCardProduct[] = [];
  for (const g of grouped) {
    const row = byProduct.get(g.productId);
    if (row) out.push(productCardProductFromListing(row));
  }
  return out;
}
