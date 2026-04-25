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
    <div className="mt-3 rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-4 py-3">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Listing promo code</span>
          <input
            type="text"
            name="couponCode"
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            placeholder="Listing promo code"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs leading-none text-zinc-100 placeholder:font-semibold placeholder:uppercase placeholder:tracking-wide placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
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
