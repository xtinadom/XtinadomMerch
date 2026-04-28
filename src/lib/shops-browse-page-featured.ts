import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import type { FeaturedCarouselItem } from "@/lib/shop-featured-carousel";
import { shopsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { parseShopOrderedFeaturedProductIds } from "@/lib/shop-ordered-featured-product-ids";
import { sortShopsForBrowse } from "@/lib/shops-browse";

const CREATOR_SHOP_BASE = {
  active: true,
  listedOnShopsBrowse: true,
  slug: { not: PLATFORM_SHOP_SLUG },
} as const;

export type ShopBrowseFeaturedRow = {
  id: string;
  slug: string;
  displayName: string;
  profileImageUrl: string | null;
  bio: string | null;
  totalSalesCents: number;
};

const select = {
  id: true,
  slug: true,
  displayName: true,
  profileImageUrl: true,
  bio: true,
  totalSalesCents: true,
} as const;

const CAROUSEL_CAP = 12;

/**
 * Admin-ordered featured shop strip: creator shop ids on the platform shop row, then
 * `totalSalesCents`, then `storefrontViewCount`, then any remaining active creator shops.
 * Composed into carousel items via {@link getHomeFeaturedShopsCarouselItems}.
 */
export async function getShopsBrowsePageFeaturedCarouselShops(
  limit = CAROUSEL_CAP,
): Promise<ShopBrowseFeaturedRow[]> {
  const platform = await prisma.shop.findUnique({
    where: { slug: PLATFORM_SHOP_SLUG },
    select: { browseShopsPageFeaturedShopIds: true },
  });
  const adminIds = parseShopOrderedFeaturedProductIds(
    platform?.browseShopsPageFeaturedShopIds ?? null,
  ).slice(0, limit);

  const used = new Set<string>();
  const out: ShopBrowseFeaturedRow[] = [];

  if (adminIds.length > 0) {
    const rows = await prisma.shop.findMany({
      where: { ...CREATOR_SHOP_BASE, id: { in: adminIds } },
      select: select,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const id of adminIds) {
      const row = byId.get(id);
      if (row) {
        out.push({
          id: row.id,
          slug: row.slug,
          displayName: row.displayName,
          profileImageUrl: row.profileImageUrl,
          bio: row.bio,
          totalSalesCents: row.totalSalesCents,
        });
        used.add(row.id);
      }
      if (out.length >= limit) return out;
    }
  }

  const fillSales = limit - out.length;
  if (fillSales > 0) {
    const rows = await prisma.shop.findMany({
      where: {
        ...CREATOR_SHOP_BASE,
        ...(used.size > 0 ? { id: { notIn: [...used] } } : {}),
      },
      orderBy: { totalSalesCents: "desc" },
      take: fillSales + 40,
      select: select,
    });
    for (const row of rows) {
      if (out.length >= limit) break;
      if (used.has(row.id)) continue;
      used.add(row.id);
      out.push({
        id: row.id,
        slug: row.slug,
        displayName: row.displayName,
        profileImageUrl: row.profileImageUrl,
        bio: row.bio,
        totalSalesCents: row.totalSalesCents,
      });
    }
  }

  const fillViews = limit - out.length;
  if (fillViews > 0) {
    const rows = await prisma.shop.findMany({
      where: {
        ...CREATOR_SHOP_BASE,
        ...(used.size > 0 ? { id: { notIn: [...used] } } : {}),
      },
      orderBy: { storefrontViewCount: "desc" },
      take: fillViews + 50,
      select: select,
    });
    for (const row of rows) {
      if (out.length >= limit) break;
      if (used.has(row.id)) continue;
      used.add(row.id);
      out.push({
        id: row.id,
        slug: row.slug,
        displayName: row.displayName,
        profileImageUrl: row.profileImageUrl,
        bio: row.bio,
        totalSalesCents: row.totalSalesCents,
      });
    }
  }

  const fillAny = limit - out.length;
  if (fillAny > 0) {
    const rows = await prisma.shop.findMany({
      where: {
        ...CREATOR_SHOP_BASE,
        ...(used.size > 0 ? { id: { notIn: [...used] } } : {}),
      },
      orderBy: [{ displayName: "asc" }],
      take: fillAny + 60,
      select: select,
    });
    for (const row of rows) {
      if (out.length >= limit) break;
      if (used.has(row.id)) continue;
      used.add(row.id);
      out.push({
        id: row.id,
        slug: row.slug,
        displayName: row.displayName,
        profileImageUrl: row.profileImageUrl,
        bio: row.bio,
        totalSalesCents: row.totalSalesCents,
      });
    }
  }

  return out;
}

function mergeFeaturedRowsWithBrowseList(
  featuredRows: ShopBrowseFeaturedRow[],
  browseShopsSorted: ShopBrowseFeaturedRow[],
  limit: number,
): ShopBrowseFeaturedRow[] {
  const seen = new Set(featuredRows.map((s) => s.id));
  const merged = [...featuredRows];
  for (const s of browseShopsSorted) {
    if (merged.length >= limit) break;
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    merged.push(s);
  }
  return merged;
}

/**
 * Featured shops carousel for the platform home footer (same composition as the former `/shops` strip).
 * Fills from editorial-sorted browse shops when admin picks + internal backfill need more rows.
 */
export async function getHomeFeaturedShopsCarouselItems(): Promise<FeaturedCarouselItem[]> {
  let featuredRows: ShopBrowseFeaturedRow[] = [];
  try {
    featuredRows = await getShopsBrowsePageFeaturedCarouselShops(CAROUSEL_CAP);
  } catch (e) {
    console.warn("[getHomeFeaturedShopsCarouselItems] featured carousel load failed (migrations applied?)", e);
  }

  const raw = await prisma.shop.findMany({
    where: CREATOR_SHOP_BASE,
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
  });

  const editorialSorted = sortShopsForBrowse(raw, "editorial").map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.displayName,
    profileImageUrl: s.profileImageUrl,
    bio: s.bio,
    totalSalesCents: s.totalSalesCents,
  }));

  const merged = mergeFeaturedRowsWithBrowseList(featuredRows, editorialSorted, CAROUSEL_CAP);
  return shopsToFeaturedCarouselItems(merged);
}
