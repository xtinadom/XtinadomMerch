"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";
import {
  finalizeListingFeePaymentIntent,
  startListingFeePaymentIntent,
} from "@/actions/dashboard-marketplace";

export function ListingFeeCardPay(props: {
  listingId: string;
  paidListingFeeLabel: string;
  stripePublishableKey: string;
}) {
  const { listingId, paidListingFeeLabel, stripePublishableKey } = props;
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const mountEl = mountRef.current;
    if (!mountEl || !stripePublishableKey.trim()) return;

    (async () => {
      try {
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
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        const lower = msg.toLowerCase();
        setError(
          lower.includes("network") || lower.includes("failed to fetch")
            ? "Could not reach Stripe (check internet, VPN, firewall, or extensions blocking js.stripe.com)."
            : `Could not load Stripe: ${msg}`,
        );
      }
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
    setBusy(true);
    try {
      const started = await startListingFeePaymentIntent(listingId);
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
      const finalized = await finalizeListingFeePaymentIntent(paymentIntent.id);
      if (!finalized.ok) {
        setError(finalized.error);
        return;
      }
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();
      setError(
        lower.includes("network") || lower.includes("failed to fetch")
          ? "Payment failed due to a network error. Check your connection, VPN, or extensions blocking Stripe."
          : msg.trim() || "Payment failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <p className="text-[11px] text-zinc-500">
        Pay {paidListingFeeLabel} now — your card is charged immediately (no redirect).
      </p>
      <div ref={mountRef} className="rounded border border-zinc-800 bg-zinc-900/40 px-2 py-2" />
      {error ? <p className="text-xs text-red-300/90">{error}</p> : null}
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => void onPay()}
        className="rounded border border-blue-900/60 bg-blue-950/30 px-3 py-1.5 text-xs text-blue-200 hover:border-blue-700/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Processing…" : `Pay ${paidListingFeeLabel}`}
      </button>
    </div>
  );
}
