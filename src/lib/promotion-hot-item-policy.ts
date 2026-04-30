import { prisma } from "@/lib/prisma";
import { PromotionKind, PromotionPurchaseStatus } from "@/generated/prisma/enums";
import {
  HOT_ITEM_PLATFORM_PERIOD_CAP,
  PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER,
  TOP_SHOP_PLATFORM_PERIOD_CAP,
  PROMOTION_PERIOD_DAYS,
} from "./promotion-policy-shared";
import {
  addPacificCalendarDays,
  formatPromotionPlacementPeriodLabel,
  getPromotionPeriodIndexContaining,
  pacificInclusiveDayCountFromThroughPeriodEnd,
  prorateCentsForRemainingDays,
  promotionPeriodEndExclusiveUtc,
  promotionPeriodStartUtc,
} from "./promotion-period-pacific";

/**
 * Placement offers with Prisma slot counts. Pacific two-week windows — see {@link "./promotion-period-pacific"}.
 */

export type PlacementPeriodOffer =
  | {
      amountCents: number;
      /** Always the Pacific period start for the purchased window (slot accounting). */
      eligibleFrom: Date;
      placementPeriodLabel: string;
      /** Mid-period purchase paid less than full listing price. */
      isProrated: boolean;
      /** Buying the second future period (filled current + next) at 2× base. */
      isSecondFuturePeriod: boolean;
      /** 0 = current Pacific period, 1 = next, 2 = second next (2×). No purchases beyond 2. */
      futurePeriodOffset: 0 | 1 | 2;
    }
  | { error: string };

/** @deprecated Use {@link PlacementPeriodOffer} */
export type MonthlyPlacementOffer = PlacementPeriodOffer;
/** @deprecated Use {@link PlacementPeriodOffer} */
export type HotItemPlacementOffer = PlacementPeriodOffer;

/** Paid rows of `kind` attributed to the promotion window starting `periodStartUtc` (Pacific period chain). */
export async function countPromotionKindPaidForPlacementPeriod(
  kind: PromotionKind,
  periodStartUtc: Date,
): Promise<number> {
  const periodEndEx = addPacificCalendarDays(periodStartUtc, PROMOTION_PERIOD_DAYS);
  return prisma.promotionPurchase.count({
    where: {
      kind,
      status: PromotionPurchaseStatus.paid,
      paidAt: { not: null },
      OR: [
        {
          eligibleFrom: {
            gte: periodStartUtc,
            lt: periodEndEx,
          },
        },
        {
          eligibleFrom: null,
          paidAt: {
            gte: periodStartUtc,
            lt: periodEndEx,
          },
        },
      ],
    },
  });
}

/** @deprecated Use {@link countPromotionKindPaidForPlacementPeriod} */
export async function countPromotionKindPaidForPlacementMonthUtc(
  kind: PromotionKind,
  placementMonthStart: Date,
): Promise<number> {
  return countPromotionKindPaidForPlacementPeriod(kind, placementMonthStart);
}

export async function countHotItemPaidForPlacementPeriodUtc(
  periodStartUtc: Date,
): Promise<number> {
  return countPromotionKindPaidForPlacementPeriod(
    PromotionKind.HOT_FEATURED_ITEM,
    periodStartUtc,
  );
}

/** @deprecated Use {@link countHotItemPaidForPlacementPeriodUtc} */
export async function countHotItemPaidForPlacementMonthUtc(
  placementMonthStart: Date,
): Promise<number> {
  return countHotItemPaidForPlacementPeriodUtc(placementMonthStart);
}

export async function countTopShopPaidForPlacementPeriodUtc(
  periodStartUtc: Date,
): Promise<number> {
  return countPromotionKindPaidForPlacementPeriod(
    PromotionKind.FEATURED_SHOP_HOME,
    periodStartUtc,
  );
}

/** @deprecated Use {@link countTopShopPaidForPlacementPeriodUtc} */
export async function countTopShopPaidForPlacementMonthUtc(
  placementMonthStart: Date,
): Promise<number> {
  return countTopShopPaidForPlacementPeriodUtc(placementMonthStart);
}

export async function resolveCappedPlacementPeriodOffer(
  basePriceCents: number,
  periodCap: number,
  kind: PromotionKind,
  soldOutMessage: string,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  const r = await resolveCappedPlacementPeriodOfferWithCounts(
    basePriceCents,
    periodCap,
    kind,
    soldOutMessage,
    nowInput,
  );
  return r.offer;
}

export type CappedPlacementPeriodOfferWithCounts = {
  offer: PlacementPeriodOffer;
  /** Paid slots for offsets [0,1,2] from the current placement period. */
  filledCounts: [number, number, number];
  /** Pacific period starts for offsets [0,1,2] from the current placement period. */
  periodStarts: [Date, Date, Date];
};

export async function resolveCappedPlacementPeriodOfferWithCounts(
  basePriceCents: number,
  periodCap: number,
  kind: PromotionKind,
  soldOutMessage: string,
  nowInput = new Date(),
): Promise<CappedPlacementPeriodOfferWithCounts> {
  if (basePriceCents <= 0) {
    const idx = getPromotionPeriodIndexContaining(nowInput);
    const periodStarts = [0, 1, 2].map((o) => promotionPeriodStartUtc(idx + o)) as [Date, Date, Date];
    return { offer: { error: "Invalid promotion price." }, filledCounts: [0, 0, 0], periodStarts };
  }
  if (periodCap <= 0) {
    const idx = getPromotionPeriodIndexContaining(nowInput);
    const periodStarts = [0, 1, 2].map((o) => promotionPeriodStartUtc(idx + o)) as [Date, Date, Date];
    return { offer: { error: "Invalid cap." }, filledCounts: [0, 0, 0], periodStarts };
  }

  const currentIdx = getPromotionPeriodIndexContaining(nowInput);

  const offsets: Array<0 | 1 | 2> = [0, 1, 2];
  const periodStarts = offsets.map((offset) => promotionPeriodStartUtc(currentIdx + offset)) as [
    Date,
    Date,
    Date,
  ];
  const filledCounts = (await Promise.all(
    periodStarts.map((periodStart) => countPromotionKindPaidForPlacementPeriod(kind, periodStart)),
  )) as [number, number, number];

  for (const offset of offsets) {
    const idx = currentIdx + offset;
    const periodStart = periodStarts[offset];
    const filled = filledCounts[offset];

    if (filled >= periodCap) {
      continue;
    }

    const periodEndExclusive = promotionPeriodEndExclusiveUtc(idx);
    const periodEndInclusive = new Date(periodEndExclusive.getTime() - 1);

    let amountCents: number;
    let isProrated = false;
    const isSecondFuturePeriod = offset === 2;

    if (offset === 0) {
      const daysRemaining = pacificInclusiveDayCountFromThroughPeriodEnd(
        nowInput,
        periodEndInclusive,
      );
      amountCents = prorateCentsForRemainingDays(basePriceCents, daysRemaining);
      isProrated = daysRemaining < PROMOTION_PERIOD_DAYS;
    } else if (offset === 1) {
      amountCents = basePriceCents;
    } else {
      amountCents = basePriceCents * PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER;
    }

    if (!Number.isSafeInteger(amountCents)) {
      return { offer: { error: "Promotion price overflow." }, filledCounts, periodStarts };
    }

    return {
      offer: {
        amountCents,
        eligibleFrom: periodStart,
        placementPeriodLabel: formatPromotionPlacementPeriodLabel(periodStart),
        isProrated,
        isSecondFuturePeriod,
        futurePeriodOffset: offset as 0 | 1 | 2,
      },
      filledCounts,
      periodStarts,
    };
  }

  return { offer: { error: soldOutMessage }, filledCounts, periodStarts };
}

export async function resolveHotItemPlacementOffer(
  basePriceCents: number,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  const r = await resolveHotItemPlacementOfferWithCounts(basePriceCents, nowInput);
  return r.offer;
}

export async function resolveHotItemPlacementOfferWithCounts(
  basePriceCents: number,
  nowInput = new Date(),
): Promise<CappedPlacementPeriodOfferWithCounts> {
  return resolveCappedPlacementPeriodOfferWithCounts(
    basePriceCents,
    HOT_ITEM_PLATFORM_PERIOD_CAP,
    PromotionKind.HOT_FEATURED_ITEM,
    "Hot item promotion slots are fully booked for the next two placement periods. Try again later or contact support.",
    nowInput,
  );
}

export async function resolveTopShopPlacementOffer(
  basePriceCents: number,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  const r = await resolveTopShopPlacementOfferWithCounts(basePriceCents, nowInput);
  return r.offer;
}

export async function resolveTopShopPlacementOfferWithCounts(
  basePriceCents: number,
  nowInput = new Date(),
): Promise<CappedPlacementPeriodOfferWithCounts> {
  return resolveCappedPlacementPeriodOfferWithCounts(
    basePriceCents,
    TOP_SHOP_PLATFORM_PERIOD_CAP,
    PromotionKind.FEATURED_SHOP_HOME,
    "Top shop promotion slots are fully booked for the next two placement periods. Try again later or contact support.",
    nowInput,
  );
}

/** Popular item: no platform slot cap — current Pacific period only, prorated by remaining days. */
export async function resolvePopularPlacementOffer(
  basePriceCents: number,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  if (basePriceCents <= 0) return { error: "Invalid promotion price." };

  const idx = getPromotionPeriodIndexContaining(nowInput);
  const periodStart = promotionPeriodStartUtc(idx);
  const periodEndExclusive = promotionPeriodEndExclusiveUtc(idx);
  const periodEndInclusive = new Date(periodEndExclusive.getTime() - 1);
  const daysRemaining = pacificInclusiveDayCountFromThroughPeriodEnd(nowInput, periodEndInclusive);
  const amountCents = prorateCentsForRemainingDays(basePriceCents, daysRemaining);

  if (!Number.isSafeInteger(amountCents)) {
    return { error: "Promotion price overflow." };
  }

  return {
    amountCents,
    eligibleFrom: periodStart,
    placementPeriodLabel: formatPromotionPlacementPeriodLabel(periodStart),
    isProrated: daysRemaining < PROMOTION_PERIOD_DAYS,
    isSecondFuturePeriod: false,
    futurePeriodOffset: 0,
  };
}

/** @deprecated Use {@link resolveCappedPlacementPeriodOffer} */
export async function resolveMonthlyCappedPlacementOffer(
  basePriceCents: number,
  monthlyCap: number,
  kind: PromotionKind,
  soldOutMessage: string,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  return resolveCappedPlacementPeriodOffer(basePriceCents, monthlyCap, kind, soldOutMessage, nowInput);
}
