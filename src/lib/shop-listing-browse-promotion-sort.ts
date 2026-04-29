import type { Prisma } from "@/generated/prisma/client";
import { PromotionKind, PromotionPurchaseStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { isPaidPromotionActiveNow } from "@/lib/promotion-policy-shared";

/**
 * paid “Popular item” placement (`MOST_POPULAR_OF_TAG_ITEM`) — used only for **Popular** browse sort.
 */
export const shopListingPopularItemPromotionPurchasesArgs = {
  where: {
    status: PromotionPurchaseStatus.paid,
    paidAt: { not: null },
    kind: PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
  },
  select: { paidAt: true, eligibleFrom: true, status: true, kind: true },
} satisfies Pick<Prisma.PromotionPurchaseFindManyArgs, "where" | "select">;

type PopularBrowseListing = {
  id: string;
  product: { storefrontViewCount: number; name: string };
  promotionPurchases?:
    | {
        paidAt: Date | null;
        eligibleFrom: Date | null;
        status: string;
        kind: PromotionKind;
      }[]
    | null;
};

function latestPopularItemPromotionPaidMs(row: PopularBrowseListing): number {
  let best = 0;
  for (const p of row.promotionPurchases ?? []) {
    if (!isPaidPromotionActiveNow(p)) continue;
    const t = (p.eligibleFrom ?? p.paidAt)!.getTime();
    if (t > best) best = t;
  }
  return best;
}

/**
 * Popular sort: newest paid **Popular item** promotion first, then revenue (order lines on this
 * listing), then product storefront views, then name.
 */
export async function sortShopListingsForPopularBrowse<T extends PopularBrowseListing>(
  listings: T[],
): Promise<T[]> {
  if (listings.length === 0) return listings;
  const ids = listings.map((l) => l.id);
  const lines = await prisma.orderLine.findMany({
    where: { shopListingId: { in: ids } },
    select: { shopListingId: true, quantity: true, unitPriceCents: true },
  });
  const revenueByListing = new Map<string, number>();
  for (const line of lines) {
    if (!line.shopListingId) continue;
    const add = line.quantity * line.unitPriceCents;
    revenueByListing.set(
      line.shopListingId,
      (revenueByListing.get(line.shopListingId) ?? 0) + add,
    );
  }

  return [...listings].sort((a, b) => {
    const pa = latestPopularItemPromotionPaidMs(a);
    const pb = latestPopularItemPromotionPaidMs(b);
    if (pa !== pb) return pb - pa;

    const ra = revenueByListing.get(a.id) ?? 0;
    const rb = revenueByListing.get(b.id) ?? 0;
    if (ra !== rb) return rb - ra;

    const va = a.product.storefrontViewCount;
    const vb = b.product.storefrontViewCount;
    if (va !== vb) return vb - va;

    return a.product.name.localeCompare(b.product.name);
  });
}
