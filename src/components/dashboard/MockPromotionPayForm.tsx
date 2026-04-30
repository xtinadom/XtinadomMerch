"use client";

import { useState } from "react";
import { PromotionKind } from "@/generated/prisma/enums";
import { dashboardMockPayPromotion } from "@/actions/dashboard-promotions";
import {
  PROMOTION_KIND_OPTIONS,
  promotionKindRequiresListing,
  promotionKindSurfaceDescription,
  promotionPriceCentsForKind,
} from "@/lib/promotions";
import { PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER } from "@/lib/promotion-policy-shared";
import type { PopularItemPromotionUi, PromotionMonthlySlotUi } from "@/components/dashboard/ListingsPromotedSection";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function MockPromotionPayForm(props: {
  liveListingPicklist: { id: string; label: string }[];
  hotItemPromotion: PromotionMonthlySlotUi;
  topShopPromotion: PromotionMonthlySlotUi;
  popularItemPromotion: PopularItemPromotionUi;
}) {
  const { liveListingPicklist, hotItemPromotion, topShopPromotion, popularItemPromotion } = props;
  const [kind, setKind] = useState<PromotionKind>(() =>
    liveListingPicklist.length === 0
      ? PromotionKind.FEATURED_SHOP_HOME
      : PROMOTION_KIND_OPTIONS[0]!.kind,
  );
  const needsListing = promotionKindRequiresListing(kind);
  const priceCents =
    kind === PromotionKind.HOT_FEATURED_ITEM && hotItemPromotion.offer
      ? hotItemPromotion.offer.amountCents
      : kind === PromotionKind.FEATURED_SHOP_HOME && topShopPromotion.offer
        ? topShopPromotion.offer.amountCents
        : kind === PromotionKind.MOST_POPULAR_OF_TAG_ITEM && popularItemPromotion.offer
          ? popularItemPromotion.offer.amountCents
          : promotionPriceCentsForKind(kind);

  if (needsListing && liveListingPicklist.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-500">
        Mock listing-targeted promotions need at least one <strong className="text-zinc-400">Live</strong> listing — or switch to a shop-level promotion.
      </div>
    );
  }

  return (
    <form
      action={dashboardMockPayPromotion}
      className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
    >
      <p className="text-[11px] text-amber-600/90">
        Mock checkout — no real charge. Two-week Pacific windows and proration as in the blurb above.
      </p>
      {kind === PromotionKind.HOT_FEATURED_ITEM && hotItemPromotion.offer?.isDeferred ? (
        <p className="text-[11px] text-amber-200/90">
          Hot period full ({hotItemPromotion.slotsUsedUtcThisMonth}/{hotItemPromotion.monthlyCap}). Mock records{" "}
          {hotItemPromotion.offer.placementMonthLabel} at{" "}
          {hotItemPromotion.offer.isSecondFuturePeriod
            ? `${PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}×`
            : "standard rate"}{" "}
          ({formatMoney(priceCents)}).
        </p>
      ) : null}
      {kind === PromotionKind.FEATURED_SHOP_HOME && topShopPromotion.offer?.isDeferred ? (
        <p className="text-[11px] text-amber-200/90">
          Top shop period full ({topShopPromotion.slotsUsedUtcThisMonth}/{topShopPromotion.monthlyCap}). Mock records{" "}
          {topShopPromotion.offer.placementMonthLabel} at{" "}
          {topShopPromotion.offer.isSecondFuturePeriod
            ? `${PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}×`
            : "standard rate"}{" "}
          ({formatMoney(priceCents)}).
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[11px] text-zinc-500">
          Promotion type
          <select
            name="promotionKind"
            value={kind}
            onChange={(e) => setKind(e.target.value as PromotionKind)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
          >
            {PROMOTION_KIND_OPTIONS.map((o) => (
              <option key={o.kind} value={o.kind}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] leading-snug text-zinc-600">
            {promotionKindSurfaceDescription(kind)}
          </p>
        </label>
        {needsListing ? (
          <label className="block text-[11px] text-zinc-500">
            Select an active listing
            <select
              name="shopListingId"
              required
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
            >
              <option value="">Select…</option>
              {liveListingPicklist.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="self-end text-[11px] leading-snug text-zinc-500">
            This boost applies to your entire shop (not an individual listing).
          </p>
        )}
      </div>
      <button
        type="submit"
        className="rounded border border-amber-900/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-100 hover:border-amber-700/50"
      >
        Record mock promotion payment
      </button>
    </form>
  );
}
