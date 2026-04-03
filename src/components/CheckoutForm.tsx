"use client";

import { useState } from "react";
import { startCheckout } from "@/actions/checkout";

const PRESETS = [200, 500, 1000];

type Props = {
  tipAllowed: boolean;
  subtotalCents: number;
  shippingCents: number;
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
}: Props) {
  const [tipCents, setTipCents] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-8"
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
            Tips are available for photo-printed and used sub catalog items.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              key="none"
              type="button"
              onClick={() => {
                setTipCents(0);
                setCustomTip("");
              }}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tipCents === 0
                  ? "bg-rose-900/50 text-rose-100"
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
                    ? "bg-rose-900/50 text-rose-100"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {formatPrice(c)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-end gap-3">
            <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
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

      <div className="rounded-xl border border-zinc-800 p-5 text-sm text-zinc-400">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPrice(subtotalCents)}</span>
        </div>
        {tipAllowed && tipCents > 0 && (
          <div className="mt-2 flex justify-between text-rose-200/80">
            <span>Tip</span>
            <span>{formatPrice(tipCents)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between">
          <span>Shipping (flat)</span>
          <span>{formatPrice(shippingCents)}</span>
        </div>
        <div className="mt-3 flex justify-between border-t border-zinc-800 pt-3 font-medium text-zinc-100">
          <span>Total due at checkout</span>
          <span>
            {formatPrice(subtotalCents + (tipAllowed ? tipCents : 0) + shippingCents)}
          </span>
        </div>
        <p className="mt-3 text-xs text-zinc-600">
          Pay with card or Cash App Pay (US). You will enter payment on Stripe&apos;s secure page.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-rose-700 py-3 text-sm font-medium text-white transition hover:bg-rose-600 disabled:opacity-50"
      >
        {pending ? "Redirecting…" : "Continue to payment"}
      </button>
    </form>
  );
}
