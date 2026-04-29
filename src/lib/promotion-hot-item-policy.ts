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
  if (basePriceCents <= 0) return { error: "Invalid promotion price." };
  if (periodCap <= 0) return { error: "Invalid cap." };

  const currentIdx = getPromotionPeriodIndexContaining(nowInput);

  for (let offset = 0; offset <= 2; offset++) {
    const idx = currentIdx + offset;
    const periodStart = promotionPeriodStartUtc(idx);
    const filled = await countPromotionKindPaidForPlacementPeriod(kind, periodStart);

    if (filled >= periodCap) continue;

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
      return { error: "Promotion price overflow." };
    }

    return {
      amountCents,
      eligibleFrom: periodStart,
      placementPeriodLabel: formatPromotionPlacementPeriodLabel(periodStart),
      isProrated,
      isSecondFuturePeriod,
      futurePeriodOffset: offset as 0 | 1 | 2,
    };
  }

  return { error: soldOutMessage };
}

export async function resolveHotItemPlacementOffer(
  basePriceCents: number,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  return resolveCappedPlacementPeriodOffer(
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
  return resolveCappedPlacementPeriodOffer(
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
