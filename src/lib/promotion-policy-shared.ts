import { PromotionPurchaseStatus } from "@/generated/prisma/enums";
import {
  PROMOTION_PERIOD_DAYS,
  getPromotionPeriodIndexContaining,
  promotionPeriodEndExclusiveUtc,
  promotionPeriodStartUtc,
} from "@/lib/promotion-period-pacific";

/**
 * Pure promotion policy helpers and caps (safe for Client Components — no Prisma / `pg`).
 * Pacific period math: {@link "./promotion-period-pacific"}.
 * Database-backed placement offers: {@link "./promotion-hot-item-policy"}.
 */

/** Paid Hot item placements per two-week Pacific period (platform-wide). */
export const HOT_ITEM_PLATFORM_PERIOD_CAP = 10;

/** Paid Top shop placements per two-week Pacific period (platform-wide; two home slots are reserved). */
export const TOP_SHOP_PLATFORM_PERIOD_CAP = 23;

/** @deprecated Use {@link HOT_ITEM_PLATFORM_PERIOD_CAP} */
export const HOT_ITEM_PLATFORM_MONTHLY_CAP = HOT_ITEM_PLATFORM_PERIOD_CAP;

/** @deprecated Use {@link TOP_SHOP_PLATFORM_PERIOD_CAP} */
export const TOP_SHOP_PLATFORM_MONTHLY_CAP = TOP_SHOP_PLATFORM_PERIOD_CAP;

/** Full calendar length of one listing promotion window (Pacific). Re-exported from {@link PROMOTION_PERIOD_DAYS}. */
export const PROMOTION_ACTIVE_DAYS = PROMOTION_PERIOD_DAYS;
export { PROMOTION_PERIOD_DAYS };

/** Second future period (when the next period is also full) is charged at this multiple. */
export const PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER = 2;

/** @deprecated */
export const PROMOTION_DEFERRED_MONTH_PRICE_MULTIPLIER = PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER;
/** @deprecated */
export const HOT_ITEM_NEXT_MONTH_PRICE_MULTIPLIER = PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER;

function utcYearMonth(d: Date): { y: number; m: number } {
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}

/** @deprecated UTC month helper — used only by non-promotion code (e.g. shop browse sales). */
export function startOfUtcMonthContaining(d: Date): Date {
  const { y, m } = utcYearMonth(d);
  return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
}

export function addUtcMonths(base: Date, deltaMonths: number): Date {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  return new Date(Date.UTC(y, m + deltaMonths, 1, 0, 0, 0, 0));
}

/** @deprecated Use {@link placementPromotionPeriodStartUtcForPurchase} */
export function placementMonthStartUtcForPurchase(row: {
  eligibleFrom: Date | null;
  paidAt: Date | null;
}): Date | null {
  return placementPromotionPeriodStartUtcForPurchase(row);
}

/** Period start (Pacific-aligned window) this purchase counts toward; prefers stored `eligibleFrom`. */
export function placementPromotionPeriodStartUtcForPurchase(row: {
  eligibleFrom: Date | null;
  paidAt: Date | null;
}): Date | null {
  if (row.eligibleFrom) return row.eligibleFrom;
  if (!row.paidAt) return null;
  const idx = getPromotionPeriodIndexContaining(row.paidAt);
  return promotionPeriodStartUtc(idx);
}

/**
 * When the placement becomes active for the buyer: deferred periods start at `eligibleFrom`;
 * otherwise payment time.
 */
export function promotionEffectiveStartUtc(row: {
  eligibleFrom: Date | null;
  paidAt: Date | null;
}): Date | null {
  if (!row.paidAt) return null;
  if (row.eligibleFrom && row.eligibleFrom.getTime() > row.paidAt.getTime()) {
    return row.eligibleFrom;
  }
  return row.paidAt;
}

/** End of the active listing-promotion window (same Pacific period end for everyone in that placement period). */
export function promotionEffectiveEndUtc(row: {
  eligibleFrom: Date | null;
  paidAt: Date | null;
}): Date | null {
  const anchor = row.eligibleFrom ?? row.paidAt;
  if (!anchor) return null;
  const idx = row.eligibleFrom
    ? getPromotionPeriodIndexContaining(row.eligibleFrom)
    : getPromotionPeriodIndexContaining(row.paidAt!);
  return new Date(promotionPeriodEndExclusiveUtc(idx).getTime() - 1);
}

export function isPaidPromotionActiveNow(
  row: {
    status: string;
    eligibleFrom: Date | null;
    paidAt: Date | null;
  },
  now = new Date(),
): boolean {
  if (row.status !== PromotionPurchaseStatus.paid || !row.paidAt) return false;
  const start = promotionEffectiveStartUtc(row);
  const end = promotionEffectiveEndUtc(row);
  if (!start || !end) return false;
  return now >= start && now <= end;
}

/** @deprecated Use {@link isPaidPromotionActiveNow} */
export function isPaidHotItemPromotionActiveNow(
  row: Parameters<typeof isPaidPromotionActiveNow>[0],
  now?: Date,
): boolean {
  return isPaidPromotionActiveNow(row, now);
}
