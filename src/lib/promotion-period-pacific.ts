/** Pacific (Los Angeles) placement windows for listing promotions — shared civil calendar math. */

export const PROMOTION_TIME_ZONE = "America/Los_Angeles";

/** Each placement window is this many calendar days (two Mondays-to-two-Sundays spans). */
export const PROMOTION_PERIOD_DAYS = 14;

/**
 * Anchor for period index 0: Monday Apr 27, 2026 12:00am Pacific (first instant of that local day).
 * Periods repeat every {@link PROMOTION_PERIOD_DAYS} Pacific calendar days from this instant.
 */
export const PROMOTION_PERIOD_ANCHOR_YEAR = 2026;
export const PROMOTION_PERIOD_ANCHOR_MONTH = 4;
export const PROMOTION_PERIOD_ANCHOR_DAY = 27;

export function pacificParts(instant: Date): {
  y: number;
  m: number;
  d: number;
  hour: number;
  minute: number;
  second: number;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: PROMOTION_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(instant).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** UTC instant when the Pacific wall clock first reads yyyy-mm-dd 00:00:00. */
export function pacificMidnightUtc(y: number, mo: number, d: number): Date {
  const startGuess = Date.UTC(y, mo - 1, d - 1, 8, 0, 0);
  const endGuess = Date.UTC(y, mo - 1, d + 1, 8, 0, 0);
  for (let t = startGuess; t <= endGuess; t += 1000) {
    const p = pacificParts(new Date(t));
    if (p.y === y && p.m === mo && p.d === d && p.hour === 0 && p.minute === 0 && p.second === 0) {
      return new Date(t);
    }
  }
  throw new Error(`Could not resolve Pacific midnight for ${y}-${mo}-${d}`);
}

function addCivilDays(y: number, m: number, d: number, delta: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Moves a Pacific calendar date by `deltaDays` (civil days), keeping local midnight. */
export function addPacificCalendarDays(instant: Date, deltaDays: number): Date {
  const { y, m, d } = pacificParts(instant);
  const next = addCivilDays(y, m, d, deltaDays);
  return pacificMidnightUtc(next.y, next.m, next.d);
}

let cachedAnchor: Date | null = null;

export function promotionPeriodZeroStartUtc(): Date {
  if (cachedAnchor) return cachedAnchor;
  cachedAnchor = pacificMidnightUtc(
    PROMOTION_PERIOD_ANCHOR_YEAR,
    PROMOTION_PERIOD_ANCHOR_MONTH,
    PROMOTION_PERIOD_ANCHOR_DAY,
  );
  return cachedAnchor;
}

/** Start of promotion period `periodIndex` (0 = anchor period), Pacific Monday 00:00 boundary chain. */
export function promotionPeriodStartUtc(periodIndex: number): Date {
  if (periodIndex === 0) return promotionPeriodZeroStartUtc();
  return addPacificCalendarDays(promotionPeriodZeroStartUtc(), periodIndex * PROMOTION_PERIOD_DAYS);
}

/** First instant *after* this period (start of next period). */
export function promotionPeriodEndExclusiveUtc(periodIndex: number): Date {
  return promotionPeriodStartUtc(periodIndex + 1);
}

/** Last inclusive instant of the period (Sunday 11:59:59.999 Pacific — represented as next period start − 1ms). */
export function promotionPeriodEndInclusiveUtc(periodIndex: number): Date {
  return new Date(promotionPeriodEndExclusiveUtc(periodIndex).getTime() - 1);
}

export function getPromotionPeriodIndexContaining(instant: Date): number {
  const anchor = promotionPeriodZeroStartUtc().getTime();
  const t = instant.getTime();
  let lo = 0;
  let hi = 10_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (promotionPeriodStartUtc(mid).getTime() <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Period that should receive slot credit / pricing for a purchase made at `instant`. */
export function getPromotionPeriodIndexForPurchase(instant: Date): number {
  return getPromotionPeriodIndexContaining(instant);
}

/** Start of the current listing-promotion period (Pacific) containing `now`. */
export function currentListingPromotionPeriodStartUtc(now = new Date()): Date {
  return promotionPeriodStartUtc(getPromotionPeriodIndexContaining(now));
}

export function formatPromotionPlacementPeriodLabel(periodStartUtc: Date): string {
  return periodStartUtc.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: PROMOTION_TIME_ZONE,
  });
}

/**
 * `MM/DD–MM/DD` for the fixed Pacific two-week cycle (Mon 12:00am start → Sun 11:59pm end) for this purchase’s
 * placement period — not the instant the buyer paid.
 */
export function formatPacificPromotionWindowMmDdRange(input: {
  eligibleFrom: Date | null;
  paidAt: Date | null;
}): string | null {
  if (!input.paidAt) return null;
  const idx = input.eligibleFrom
    ? getPromotionPeriodIndexContaining(input.eligibleFrom)
    : getPromotionPeriodIndexContaining(input.paidAt);
  const startUtc = promotionPeriodStartUtc(idx);
  const endInclusiveUtc = new Date(promotionPeriodEndExclusiveUtc(idx).getTime() - 1);
  const a = pacificParts(startUtc);
  const b = pacificParts(endInclusiveUtc);
  const mmdd = (p: { m: number; d: number }) =>
    `${String(p.m).padStart(2, "0")}/${String(p.d).padStart(2, "0")}`;
  return `${mmdd(a)}–${mmdd(b)}`;
}

/**
 * Inclusive Pacific calendar days from `fromInstant` through end of period (inclusive of both local dates).
 */
export function pacificInclusiveDayCountFromThroughPeriodEnd(
  fromInstant: Date,
  periodEndInclusiveUtc: Date,
): number {
  const startDay = pacificParts(fromInstant);
  const endDay = pacificParts(periodEndInclusiveUtc);
  const startOrdinal = Date.UTC(startDay.y, startDay.m - 1, startDay.d) / 86_400_000;
  const endOrdinal = Date.UTC(endDay.y, endDay.m - 1, endDay.d) / 86_400_000;
  const raw = Math.floor(endOrdinal - startOrdinal) + 1;
  return Math.max(1, Math.min(PROMOTION_PERIOD_DAYS, raw));
}

export function prorateCentsForRemainingDays(fullCents: number, remainingPacificInclusiveDays: number): number {
  const days = Math.max(1, Math.min(PROMOTION_PERIOD_DAYS, remainingPacificInclusiveDays));
  return Math.round((fullCents * days) / PROMOTION_PERIOD_DAYS);
}
