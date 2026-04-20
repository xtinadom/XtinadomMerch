"use client";

import { useActionState } from "react";
import { redeemListingSlotPromoCoupon } from "@/actions/listing-slot-promo";
import {
  initialRedeemListingSlotPromoState,
  type RedeemListingSlotPromoState,
} from "@/lib/listing-slot-promo-redeem-state";

export function ListingSlotPromoRedeemForm() {
  const [state, formAction, pending] = useActionState<
    RedeemListingSlotPromoState,
    FormData
  >(redeemListingSlotPromoCoupon, initialRedeemListingSlotPromoState);

  return (
    <div className="mt-6 rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-4 py-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Listing promo code</h3>
      <p className="mt-1 text-[11px] leading-snug text-zinc-600">
        If you received a code for extra free listings, enter it here. Each code works once per shop.
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Promo code</span>
          <input
            type="text"
            name="couponCode"
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            placeholder="Promo code"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-600 bg-zinc-800/80 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Applying…" : "Apply"}
        </button>
      </form>
      {state.status === "error" ? (
        <p className="mt-2 text-xs text-amber-200/90">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="mt-2 text-xs text-emerald-200/90">{state.message}</p>
      ) : null}
    </div>
  );
}
