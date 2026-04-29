import type { ProductCardProduct } from "@/components/ProductCard";
import { prisma } from "@/lib/prisma";
import {
  OrderStatus,
  PromotionKind,
  PromotionPurchaseStatus,
} from "@/generated/prisma/enums";
import {
  PLATFORM_ALL_PAGE_FEATURED_LIMIT,
  PLATFORM_ALL_PAGE_FEATURED_SALES_WINDOW_DAYS,
} from "@/lib/platform-all-page-featured-constants";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import {
  marketplaceAggregatedListingWhere,
  storefrontShopListingWhere,
} from "@/lib/shop-listing-storefront-visibility";
import { platformHotItemsFallbackShopSlugs } from "@/lib/marketplace-constants";
import { isPaidPromotionActiveNow } from "@/lib/promotion-policy-shared";

const productInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

/**
 * `/shop/all` “Hot items” carousel (up to {@link PLATFORM_ALL_PAGE_FEATURED_LIMIT}):
 *
 * 1. Paid **Hot item** promotions (`HOT_FEATURED_ITEM`), most recent `paidAt` first (deduped by product).
 * 2. Top **selling** listings from paid order lines in the last {@link PLATFORM_ALL_PAGE_FEATURED_SALES_WINDOW_DAYS} days.
 * 3. **Most viewed** — we only store lifetime `Product.storefrontViewCount` (no 60-day view log); sort by that.
 * 4. **Fallback shops** (env `PLATFORM_HOT_ITEMS_FALLBACK_SHOP_SLUGS` or `xtinadom`, `xtinadom-merch`).
 */
export async function getPlatformAllPageFeaturedProducts(): Promise<ProductCardProduct[]> {
  const limit = PLATFORM_ALL_PAGE_FEATURED_LIMIT;
  const used = new Set<string>();
  const out: ProductCardProduct[] = [];

  const hotPromos = await prisma.promotionPurchase.findMany({
    where: {
      status: PromotionPurchaseStatus.paid,
      paidAt: { not: null },
      kind: PromotionKind.HOT_FEATURED_ITEM,
      shopListing: {
        is: {
          ...marketplaceAggregatedListingWhere,
          product: { active: true },
        },
      },
    },
    orderBy: { paidAt: "desc" },
    select: {
      status: true,
      paidAt: true,
      eligibleFrom: true,
      shopListing: {
        include: {
          product: { include: productInclude },
          shop: { select: { slug: true, displayName: true } },
        },
      },
    },
  });

  for (const pp of hotPromos) {
    if (out.length >= limit) break;
    if (!isPaidPromotionActiveNow(pp)) continue;
    const listing = pp.shopListing;
    if (!listing) continue;
    if (used.has(listing.productId)) continue;
    used.add(listing.productId);
    out.push(productCardProductFromListing(listing));
  }

  const needSales = limit - out.length;
  if (needSales > 0) {
    const since = new Date(
      Date.now() - PLATFORM_ALL_PAGE_FEATURED_SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const grouped = await prisma.orderLine.groupBy({
      by: ["productId"],
      where: {
        order: { status: OrderStatus.paid, createdAt: { gte: since } },
        ...(used.size > 0 ? { productId: { notIn: [...used] } } : {}),
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: needSales + 40,
    });

    const ids = grouped.map((g) => g.productId);
    if (ids.length > 0) {
      const listings = await prisma.shopListing.findMany({
        where: {
          ...marketplaceAggregatedListingWhere,
          productId: { in: ids },
          product: { active: true },
        },
        orderBy: { createdAt: "asc" },
        include: {
          product: { include: productInclude },
          shop: { select: { slug: true, displayName: true } },
        },
      });
      const byProduct = new Map<string, (typeof listings)[0]>();
      for (const l of listings) {
        if (!byProduct.has(l.productId)) byProduct.set(l.productId, l);
      }
      for (const g of grouped) {
        if (out.length >= limit) break;
        const row = byProduct.get(g.productId);
        if (!row || used.has(row.productId)) continue;
        used.add(row.productId);
        out.push(productCardProductFromListing(row));
      }
    }
  }

  const needViews = limit - out.length;
  if (needViews > 0) {
    const viewedRows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        product: {
          active: true,
          ...(used.size > 0 ? { id: { notIn: [...used] } } : {}),
        },
      },
      orderBy: { product: { storefrontViewCount: "desc" } },
      take: needViews + 80,
      include: {
        product: { include: productInclude },
        shop: { select: { slug: true, displayName: true } },
      },
    });
    for (const row of viewedRows) {
      if (out.length >= limit) break;
      if (used.has(row.productId)) continue;
      used.add(row.productId);
      out.push(productCardProductFromListing(row));
    }
  }

  const needFallback = limit - out.length;
  if (needFallback > 0) {
    for (const slug of platformHotItemsFallbackShopSlugs()) {
      if (out.length >= limit) break;
      const shop = await prisma.shop.findFirst({
        where: { slug, active: true },
        select: { id: true },
      });
      if (!shop) continue;

      const rows = await prisma.shopListing.findMany({
        where: {
          shopId: shop.id,
          ...storefrontShopListingWhere,
          product: {
            active: true,
            ...(used.size > 0 ? { id: { notIn: [...used] } } : {}),
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: needFallback + 10,
        include: {
          product: { include: productInclude },
          shop: { select: { slug: true, displayName: true } },
        },
      });
      for (const row of rows) {
        if (out.length >= limit) break;
        if (used.has(row.productId)) continue;
        used.add(row.productId);
        out.push(productCardProductFromListing(row));
      }
    }
  }

  return out;
}
