import type { ProductCardProduct } from "@/components/ProductCard";
import { prisma } from "@/lib/prisma";
import { getHotListingProductsForHome } from "@/lib/marketplace-home";
import { PLATFORM_ALL_PAGE_FEATURED_LIMIT } from "@/lib/platform-all-page-featured-constants";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";

const productInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

/**
 * Up to 10 featured cards for `/shop/all`: admin-ordered picks first, then 30-day sales leaders
 * (same logic as home “hot” strip), skipping duplicates.
 */
export async function getPlatformAllPageFeaturedProducts(
  adminOrderedProductIds: string[],
): Promise<ProductCardProduct[]> {
  const adminIds = adminOrderedProductIds.slice(0, PLATFORM_ALL_PAGE_FEATURED_LIMIT);
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
        product: { include: productInclude },
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
      if (out.length >= PLATFORM_ALL_PAGE_FEATURED_LIMIT) return out;
    }
  }

  const hot = await getHotListingProductsForHome(PLATFORM_ALL_PAGE_FEATURED_LIMIT + 40);
  for (const p of hot) {
    if (out.length >= PLATFORM_ALL_PAGE_FEATURED_LIMIT) break;
    if (!used.has(p.id)) {
      out.push(p);
      used.add(p.id);
    }
  }

  return out;
}
