import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/generated/prisma/enums";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import type { ProductCardProduct } from "@/components/ProductCard";
import { productCardProductFromListing } from "@/lib/shop-listing-product";

const HOT_WINDOW_DAYS = 30;

/** Shops with a home featured listing + profile, for the platform home carousel. */
export async function getFeaturedDommeShopsForHome() {
  return prisma.shop.findMany({
    where: {
      active: true,
      slug: { not: PLATFORM_SHOP_SLUG },
      homeFeaturedListingId: { not: null },
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

/** Top-selling products (by paid order line quantity) in the last window; platform catalog listings. */
export async function getHotListingProductsForHome(
  limit = 10,
): Promise<ProductCardProduct[]> {
  const since = new Date(Date.now() - HOT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const platform = await prisma.shop.findUnique({
    where: { slug: PLATFORM_SHOP_SLUG },
    select: { id: true },
  });
  if (!platform) return [];

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
      shopId: platform.id,
      active: true,
      productId: { in: ids },
      product: { active: true },
    },
    include: {
      product: {
        include: { primaryTag: true, tags: { include: { tag: true } } },
      },
    },
  });
  const byProduct = new Map(listings.map((l) => [l.productId, l]));
  const out: ProductCardProduct[] = [];
  for (const g of grouped) {
    const row = byProduct.get(g.productId);
    if (row) out.push(productCardProductFromListing(row));
  }
  return out;
}
