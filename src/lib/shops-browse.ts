export type ShopBrowseSort = "editorial" | "sales" | "new";

export function parseShopBrowseSort(v: string | undefined): ShopBrowseSort {
  if (v === "sales" || v === "new" || v === "editorial") return v;
  return "editorial";
}

type ShopBrowseRow = {
  createdAt: Date;
  totalSalesCents: number;
  editorialPriority: number | null;
  editorialPinnedUntil: Date | null;
};

export function sortShopsForBrowse<T extends ShopBrowseRow>(
  shops: T[],
  sort: ShopBrowseSort,
): T[] {
  const out = [...shops];
  const now = Date.now();
  if (sort === "sales") {
    out.sort((a, b) => b.totalSalesCents - a.totalSalesCents);
    return out;
  }
  if (sort === "new") {
    out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return out;
  }
  out.sort((a, b) => {
    const pinA =
      a.editorialPinnedUntil && a.editorialPinnedUntil.getTime() > now ? 1 : 0;
    const pinB =
      b.editorialPinnedUntil && b.editorialPinnedUntil.getTime() > now ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    const prA = a.editorialPriority ?? -1_000_000;
    const prB = b.editorialPriority ?? -1_000_000;
    if (prA !== prB) return prB - prA;
    return b.totalSalesCents - a.totalSalesCents;
  });
  return out;
}
