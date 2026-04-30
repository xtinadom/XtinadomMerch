"use client";

import { PromotionPurchaseStatus } from "@/generated/prisma/enums";
import { ListingsTabExpandSection } from "@/components/dashboard/ListingsTabExpandSection";
import { PromotionCardPay } from "@/components/dashboard/PromotionCardPay";
import { MockPromotionPayForm } from "@/components/dashboard/MockPromotionPayForm";
import {
  parsePromotionKind,
  promotionKindLabel,
  promotionKindRequiresListing,
  promotionKindSurfaceDescription,
} from "@/lib/promotions";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER,
  PROMOTION_ACTIVE_DAYS,
} from "@/lib/promotion-policy-shared";

export type PromotionMonthlySlotUi = {
  /** Per two-week Pacific placement period (field name kept for payload stability). */
  monthlyCap: number;
  slotsUsedUtcThisMonth: number;
  offerError: string | null;
  offer: {
    amountCents: number;
    eligibleFromIso: string | null;
    isDeferred: boolean;
    isSecondFuturePeriod?: boolean;
    isProrated?: boolean;
    placementMonthLabel: string;
  } | null;
};

export type PopularItemPromotionUi = {
  offerError: string | null;
  offer: {
    amountCents: number;
    eligibleFromIso: string;
    isProrated: boolean;
    placementMonthLabel: string;
  } | null;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatPaidDateMdYy(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  } catch {
    return iso;
  }
}

export type DashboardPromotionPurchaseRow = {
  id: string;
  kind: string;
  status: string;
  amountCents: number;
  createdAtIso: string;
  paidAtIso: string | null;
  eligibleFromIso: string | null;
  /** Pacific MM/DD–MM/DD for the listing-promotion cycle this purchase belongs to (fixed Mon–Sun window). */
  activeWindowPacificRange: string | null;
  listingLabel: string | null;
};

export function ListingsPromotedSection(props: {
  purchases: DashboardPromotionPurchaseRow[];
  liveListingPicklist: { id: string; label: string }[];
  mockPromotionCheckout: boolean;
  stripePublishableKey: string | null;
  hotItemPromotion: PromotionMonthlySlotUi;
  topShopPromotion: PromotionMonthlySlotUi;
  popularItemPromotion: PopularItemPromotionUi;
}) {
  const {
    purchases,
    liveListingPicklist,
    mockPromotionCheckout,
    stripePublishableKey,
    hotItemPromotion,
    topShopPromotion,
    popularItemPromotion,
  } = props;
  const paidCount = purchases.filter((p) => p.status === PromotionPurchaseStatus.paid).length;

  return (
    <ListingsTabExpandSection
      className="mt-6"
      title="Promoted"
      titleClassName="text-violet-400/95"
      badgeCount={paidCount > 0 ? paidCount : undefined}
      blurb="Paid promotions"
    >
      <p className="mt-2 text-[11px] leading-snug text-zinc-500">
        Listing promotions use the same <strong className="font-medium text-zinc-400">two-week Pacific</strong> window
        (14 calendar days, America/Los_Angeles). Mid-period purchases are{" "}
        <strong className="font-medium text-zinc-400">prorated</strong> by whole days left in the window. If the current
        window is full, you can book the <strong className="font-medium text-zinc-400">next</strong> window at full
        price; if that is full too, the <strong className="font-medium text-zinc-400">following</strong> window at{" "}
        <strong className="font-medium text-zinc-400">{PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}×</strong>. Purchases
        cannot go beyond those two future windows.{" "}
        <strong className="font-medium text-zinc-400">Hot item</strong>:{" "}
        <strong className="font-medium text-zinc-400">{hotItemPromotion.slotsUsedUtcThisMonth}</strong> /{" "}
        {hotItemPromotion.monthlyCap} this period. <strong className="font-medium text-zinc-400">Top shop</strong>:{" "}
        <strong className="font-medium text-zinc-400">{topShopPromotion.slotsUsedUtcThisMonth}</strong> /{" "}
        {topShopPromotion.monthlyCap}. <strong className="font-medium text-zinc-400">Popular item</strong>: no platform
        slot cap (still prorated in the current window).
      </p>

      {hotItemPromotion.offerError ? (
        <p className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/90">
          {hotItemPromotion.offerError}
        </p>
      ) : null}
      {topShopPromotion.offerError ? (
        <p className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/90">
          {topShopPromotion.offerError}
        </p>
      ) : null}
      {popularItemPromotion.offerError ? (
        <p className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/90">
          {popularItemPromotion.offerError}
        </p>
      ) : null}

      {mockPromotionCheckout ? (
        <MockPromotionPayForm
          liveListingPicklist={liveListingPicklist}
          hotItemPromotion={hotItemPromotion}
          topShopPromotion={topShopPromotion}
          popularItemPromotion={popularItemPromotion}
        />
      ) : stripePublishableKey?.trim() ? (
        <PromotionCardPay
          stripePublishableKey={stripePublishableKey}
          liveListingPicklist={liveListingPicklist}
          hotItemPromotion={hotItemPromotion}
          topShopPromotion={topShopPromotion}
          popularItemPromotion={popularItemPromotion}
        />
      ) : (
        <p className="mt-3 text-xs text-amber-200/85">
          Stripe publishable key is not set. Add <code className="text-zinc-300">DEMO_MODE=1</code> (or{" "}
          <code className="text-zinc-300">MOCK_CHECKOUT=1</code>) to <code className="text-zinc-300">.env.local</code> for
          mock promotion checkout, or configure <code className="text-zinc-300">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
        </p>
      )}

      <p className="mt-3 text-[11px] leading-snug text-zinc-600">
        Paying for promotion bumps you toward the front of discovery surfaces. As others purchase promotions, newer
        purchases stack ahead where applicable.
      </p>

      {purchases.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-zinc-800/90 pt-4">
          <li className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Promotions purchased
          </li>
          {purchases.map((p) => {
            const kindEnum = parsePromotionKind(p.kind) ?? PromotionKind.FRONT_PAGE_ITEM;
            const scope =
              promotionKindRequiresListing(kindEnum) && p.listingLabel
                ? ` — ${p.listingLabel}`
                : promotionKindRequiresListing(kindEnum)
                  ? " — listing"
                  : " — shop";
            return (
              <li
                key={p.id}
                className="rounded border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0">
                    <span className="font-medium text-zinc-200">{promotionKindLabel(kindEnum)}</span>
                    <span className="text-zinc-500">{scope}</span>
                    <div className="mt-0.5 text-[11px] leading-snug text-zinc-600">
                      {promotionKindSurfaceDescription(kindEnum)}
                    </div>
                  </span>
                  <span className="shrink-0 text-right text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    Promotion purchased
                    <span className="mt-0.5 flex flex-col items-end gap-0.5 text-[11px] font-normal normal-case tracking-normal text-zinc-500">
                      <span>
                        {p.status === PromotionPurchaseStatus.paid && p.paidAtIso ? (
                          <>{formatPaidDateMdYy(p.paidAtIso)}</>
                        ) : p.status === PromotionPurchaseStatus.pending ? (
                          <>Pending payment — started {formatWhen(p.createdAtIso)}</>
                        ) : (
                          <>
                            {p.status === PromotionPurchaseStatus.failed ? "Payment failed" : "Canceled"} —{" "}
                            {formatWhen(p.createdAtIso)}
                          </>
                        )}
                      </span>
                      {p.status === PromotionPurchaseStatus.paid && p.activeWindowPacificRange ? (
                        <>
                          <span className="text-[10px] text-zinc-600">
                            Active window {p.activeWindowPacificRange} (Pacific)
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            Mon 12:00am – Sun 11:59pm PT · fixed cycle, not purchase time
                          </span>
                        </>
                      ) : null}
                      <span className="tabular-nums text-zinc-600">{formatMoney(p.amountCents)}</span>
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[11px] text-zinc-600">No promotion purchases yet.</p>
      )}
    </ListingsTabExpandSection>
  );
}
