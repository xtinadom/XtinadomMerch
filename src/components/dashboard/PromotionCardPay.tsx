"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  finalizePromotionPurchaseIntent,
  startPromotionPurchaseIntent,
} from "@/actions/dashboard-promotions";
import {
  PROMOTION_KIND_OPTIONS,
  promotionKindLabel,
  promotionKindRequiresListing,
  promotionKindSurfaceDescription,
  promotionPriceCentsForKind,
} from "@/lib/promotions";
import {
  PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER,
  PROMOTION_ACTIVE_DAYS,
} from "@/lib/promotion-policy-shared";
import type {
  PopularItemPromotionUi,
  PromotionMonthlySlotUi,
} from "@/components/dashboard/ListingsPromotedSection";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function PromotionCardPay(props: {
  stripePublishableKey: string;
  liveListingPicklist: { id: string; label: string }[];
  hotItemPromotion: PromotionMonthlySlotUi;
  topShopPromotion: PromotionMonthlySlotUi;
  popularItemPromotion: PopularItemPromotionUi;
}) {
  const { stripePublishableKey, liveListingPicklist, hotItemPromotion, topShopPromotion, popularItemPromotion } =
    props;
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<PromotionKind>(() =>
    liveListingPicklist.length === 0
      ? PromotionKind.FEATURED_SHOP_HOME
      : PROMOTION_KIND_OPTIONS[0]!.kind,
  );
  const needsListing = promotionKindRequiresListing(kind);
  const [listingId, setListingId] = useState("");
  const priceCents =
    kind === PromotionKind.HOT_FEATURED_ITEM && hotItemPromotion.offer
      ? hotItemPromotion.offer.amountCents
      : kind === PromotionKind.FEATURED_SHOP_HOME && topShopPromotion.offer
        ? topShopPromotion.offer.amountCents
        : kind === PromotionKind.MOST_POPULAR_OF_TAG_ITEM && popularItemPromotion.offer
          ? popularItemPromotion.offer.amountCents
          : promotionPriceCentsForKind(kind);

  useEffect(() => {
    if (!needsListing) setListingId("");
  }, [needsListing]);

  useEffect(() => {
    let cancelled = false;
    const mountEl = mountRef.current;
    if (!mountEl || !stripePublishableKey.trim()) return;

    (async () => {
      const stripe = await loadStripe(stripePublishableKey);
      if (cancelled || !stripe) {
        if (!cancelled) setError("Could not load Stripe.");
        return;
      }
      stripeRef.current = stripe;
      const elements = stripe.elements();
      const card = elements.create("card", {
        style: {
          base: {
            color: "#e4e4e7",
            fontSize: "14px",
            "::placeholder": { color: "#71717a" },
          },
          invalid: { color: "#fca5a5" },
        },
      });
      card.mount(mountEl);
      cardRef.current = card;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      try {
        cardRef.current?.destroy();
      } catch {
        /* ignore */
      }
      cardRef.current = null;
      stripeRef.current = null;
    };
  }, [stripePublishableKey]);

  async function onPay() {
    setError(null);
    if (!ready || busy) return;
    const stripe = stripeRef.current;
    const card = cardRef.current;
    if (!stripe || !card) {
      setError("Card form is not ready yet.");
      return;
    }
    if (needsListing && !listingId.trim()) {
      setError("Select a live listing.");
      return;
    }
    setBusy(true);
    try {
      const started = await startPromotionPurchaseIntent({
        promotionKind: kind,
        shopListingId: needsListing ? listingId.trim() : undefined,
      });
      if (!started.ok) {
        setError(started.error);
        return;
      }
      const { error: confirmErr, paymentIntent } = await stripe.confirmCardPayment(started.clientSecret, {
        payment_method: { card },
      });
      if (confirmErr) {
        setError(confirmErr.message ?? "Payment failed.");
        return;
      }
      if (!paymentIntent?.id) {
        setError("Stripe did not return a payment confirmation.");
        return;
      }
      const finalized = await finalizePromotionPurchaseIntent(paymentIntent.id);
      if (!finalized.ok) {
        setError(finalized.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (needsListing && liveListingPicklist.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-500">
        Listing-targeted promotions need at least one listing that is <strong className="text-zinc-400">Live</strong> on
        your storefront. Your shop doesn&apos;t have any yet — publish from the listings workflow first, or choose a shop-level boost above.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[11px] text-zinc-500">
          Promotion type
          <select
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
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
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
      <p className="text-xs text-zinc-400">
        You will be charged <strong className="text-zinc-200">{formatMoney(priceCents)}</strong> for{" "}
        <strong className="text-zinc-200">{promotionKindLabel(kind)}</strong>.
      </p>
      {kind === PromotionKind.HOT_FEATURED_ITEM && hotItemPromotion.offer?.isDeferred ? (
        <p className="text-[11px] text-amber-200/85">
          Current Hot item period is full ({hotItemPromotion.slotsUsedUtcThisMonth} / {hotItemPromotion.monthlyCap}). This
          purchase targets placement starting {hotItemPromotion.offer.placementMonthLabel} (Pacific) at{" "}
          {hotItemPromotion.offer.isSecondFuturePeriod
            ? `${PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}× the standard Hot item rate`
            : "the standard Hot item rate for that window"}
          .
        </p>
      ) : null}
      {kind === PromotionKind.FEATURED_SHOP_HOME && topShopPromotion.offer?.isDeferred ? (
        <p className="text-[11px] text-amber-200/85">
          Current Top shop period is full ({topShopPromotion.slotsUsedUtcThisMonth} / {topShopPromotion.monthlyCap}). This
          purchase targets placement starting {topShopPromotion.offer.placementMonthLabel} (Pacific) at{" "}
          {topShopPromotion.offer.isSecondFuturePeriod
            ? `${PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}× the standard Top shop rate`
            : "the standard Top shop rate for that window"}
          .
        </p>
      ) : null}
      <p className="text-[11px] text-zinc-500">
        Your card is charged immediately (no redirect). Listing promotions share the same two-week Pacific window ({" "}
        {PROMOTION_ACTIVE_DAYS} days); mid-period buys are prorated by remaining days.
        {kind === PromotionKind.HOT_FEATURED_ITEM ? (
          <> Hot item is capped at {hotItemPromotion.monthlyCap} purchases per period.</>
        ) : null}
        {kind === PromotionKind.FEATURED_SHOP_HOME ? (
          <> Top shop is capped at {topShopPromotion.monthlyCap} purchases per period.</>
        ) : null}
        {kind === PromotionKind.MOST_POPULAR_OF_TAG_ITEM ? (
          <> Popular item has no platform-wide slot cap.</>
        ) : null}
      </p>
      <div ref={mountRef} className="rounded border border-zinc-800 bg-zinc-900/40 px-2 py-2" />
      {error ? <p className="text-xs text-red-300/90">{error}</p> : null}
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => void onPay()}
        className="rounded border border-violet-900/60 bg-violet-950/30 px-3 py-1.5 text-xs text-violet-200 hover:border-violet-700/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Processing…" : `Pay ${formatMoney(priceCents)}`}
      </button>
    </div>
  );
}
