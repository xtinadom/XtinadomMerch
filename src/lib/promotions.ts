import { PromotionKind } from "@/generated/prisma/enums";

export type PromotionKindUiRow = {
  kind: PromotionKind;
  /** Short storefront label */
  label: string;
  amountCents: number;
};

export const PROMOTION_KIND_OPTIONS: PromotionKindUiRow[] = [
  { kind: PromotionKind.HOT_FEATURED_ITEM, label: "Hot item", amountCents: 3500 },
  {
    kind: PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
    label: "Popular item",
    amountCents: 5000,
  },
  { kind: PromotionKind.FEATURED_SHOP_HOME, label: "Top shop", amountCents: 7500 },
];

const KIND_TO_CENTS = new Map<PromotionKind, number>(
  PROMOTION_KIND_OPTIONS.map((r) => [r.kind, r.amountCents]),
);

export function promotionKindRequiresListing(kind: PromotionKind): boolean {
  return kind !== PromotionKind.FEATURED_SHOP_HOME;
}

export function promotionPriceCentsForKind(kind: PromotionKind): number {
  return KIND_TO_CENTS.get(kind) ?? 0;
}

export function parsePromotionKind(raw: string): PromotionKind | null {
  const t = raw.trim().toUpperCase();
  switch (t) {
    case "FRONT_PAGE_ITEM":
      return PromotionKind.FRONT_PAGE_ITEM;
    case "HOT_FEATURED_ITEM":
      return PromotionKind.HOT_FEATURED_ITEM;
    case "MOST_POPULAR_OF_TAG_ITEM":
      return PromotionKind.MOST_POPULAR_OF_TAG_ITEM;
    case "FEATURED_SHOP_HOME":
      return PromotionKind.FEATURED_SHOP_HOME;
    default:
      return null;
  }
}

export function promotionKindLabel(kind: PromotionKind): string {
  return PROMOTION_KIND_OPTIONS.find((r) => r.kind === kind)?.label ?? String(kind);
}

export function promotionKindSurfaceDescription(kind: PromotionKind): string {
  switch (kind) {
    case PromotionKind.FRONT_PAGE_ITEM:
      return 'Displays as a "hot item" on the home page.';
    case PromotionKind.HOT_FEATURED_ITEM:
      return 'Displays as a "Hot Item" on the home page and all items page.';
    case PromotionKind.MOST_POPULAR_OF_TAG_ITEM:
      return 'Displays first under the "Popular" filter on the all items page.';
    case PromotionKind.FEATURED_SHOP_HOME:
      return 'Displays as a "Featured Shop" on the home page and all shops page.';
    default:
      return "";
  }
}
