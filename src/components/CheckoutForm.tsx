"use client";

import { useState } from "react";
import { startCheckout } from "@/actions/checkout";

const PRESETS = [200, 500, 1000];

type Props = {
  tipAllowed: boolean;
  subtotalCents: number;
  shippingCents: number;
  estimatedSalesTaxRate: number | null;
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function CheckoutForm({
  tipAllowed,
  subtotalCents,
  shippingCents,
  estimatedSalesTaxRate,
}: Props) {
  const [tipCents, setTipCents] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const taxableCents = subtotalCents + (tipAllowed ? tipCents : 0);
  const taxCents =
    estimatedSalesTaxRate != null && taxableCents > 0
      ? Math.round(taxableCents * estimatedSalesTaxRate)
      : estimatedSalesTaxRate != null
        ? 0
        : null;
  const grandTotalCents =
    subtotalCents +
    (tipAllowed ? tipCents : 0) +
    shippingCents +
    (taxCents ?? 0);

  return (
    <form
      className="w-full space-y-8 text-center"
      action={async (formData) => {
        setError(null);
        setPending(true);
        formData.set("tipCents", String(tipCents));
        try {
          const r = await startCheckout(formData);
          if (r.ok) {
            window.location.href = r.url;
            return;
          }
          setError(r.error);
        } finally {
          setPending(false);
        }
      }}
    >
      {tipAllowed && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-medium text-zinc-200">Add a tip (optional)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Tips are available for photo-printed and used fans catalog items.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              key="none"
              type="button"
              onClick={() => {
                setTipCents(0);
                setCustomTip("");
              }}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tipCents === 0
                  ? "bg-blue-900/50 text-blue-100"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              No tip
            </button>
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setTipCents(c);
                  setCustomTip("");
                }}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  tipCents === c
                    ? "bg-blue-900/50 text-blue-100"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {formatPrice(c)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <label className="flex w-full max-w-[12rem] flex-col gap-1 text-left text-xs text-zinc-500">
              Custom (USD)
              <input
                type="number"
                min={0}
                step="0.01"
                value={customTip}
                onChange={(e) => {
                  setCustomTip(e.target.value);
                  const n = parseFloat(e.target.value);
                  if (Number.isFinite(n) && n >= 0) {
                    setTipCents(Math.round(n * 100));
                  } else if (e.target.value === "") {
                    setTipCents(0);
                  }
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="0.00"
              />
            </label>
          </div>
        </div>
      )}

      <div className="store-dimension-panel border-zinc-800/60 p-5 text-left text-sm text-zinc-400 shadow-none">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="text-zinc-200">{formatPrice(subtotalCents)}</span>
        </div>
        {tipAllowed && tipCents > 0 && (
          <div className="mt-2 flex justify-between text-blue-200/80">
            <span>Tip</span>
            <span>{formatPrice(tipCents)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between">
          <span>Shipping (flat)</span>
          <span className="text-zinc-200">{formatPrice(shippingCents)}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span>Estimated sales tax</span>
          {taxCents != null ? (
            <span className="text-zinc-200">{formatPrice(taxCents)}</span>
          ) : (
            <span className="text-right text-zinc-500">At checkout</span>
          )}
        </div>
        <div className="mt-3 flex justify-between border-t border-zinc-800/80 pt-3 font-medium text-zinc-100">
          <span>Estimated total</span>
          <span>
            {estimatedSalesTaxRate != null
              ? formatPrice(grandTotalCents)
              : `${formatPrice(subtotalCents + (tipAllowed ? tipCents : 0) + shippingCents)} + tax`}
          </span>
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-zinc-600">
          Tax is finalized at payment from your shipping address. Pay with card or Cash App Pay (US) on
          Stripe&apos;s page.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-amber-950/50 px-3 py-2 text-center text-sm text-amber-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-900 py-3 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Redirecting…" : "Continue to payment"}
      </button>
    </form>
  );
}
