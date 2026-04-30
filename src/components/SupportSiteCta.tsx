"use client";

import { useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { startSupportSiteCheckout } from "@/actions/support-site";

function CheckoutSubmitButton({ tipLabel }: { tipLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-zinc-600 bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition enabled:hover:bg-white disabled:cursor-wait disabled:opacity-70"
      aria-label={pending ? "Opening Stripe checkout" : `Pay with card, amount ${tipLabel}`}
    >
      {pending ? "Opening Stripe…" : `Pay with card · ${tipLabel}`}
    </button>
  );
}

export function SupportSiteCta({ tipLabel }: { tipLabel: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div>
      <button
        type="button"
        className="store-dimension-brand cursor-pointer text-xs uppercase tracking-[0.2em] text-blue-400/80 transition hover:text-blue-300/90"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        {"Support the site <3"}
      </button>

      {open ? (
        <div
          id={panelId}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id={titleId} className="text-base font-semibold text-zinc-100">
              Support the site
            </h3>
            <div id={descId} className="mt-3 space-y-3 text-left text-sm leading-relaxed text-zinc-300">
              <p>
                This platform is owned and operated by a small business.
                <br />
                Voluntary support helps
                keep the site running independently, and is genuinely appreciated.
              </p>
            </div>

            <p className="mt-2 text-xs text-zinc-500">One-time tip, processed by Stripe. Not a shop payout.</p>

            <form action={startSupportSiteCheckout} className="mt-5 space-y-2">
              <CheckoutSubmitButton tipLabel={tipLabel} />
            </form>
            <button
              type="button"
              className="mt-3 w-full rounded-lg border border-zinc-800 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
              onClick={() => setOpen(false)}
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
