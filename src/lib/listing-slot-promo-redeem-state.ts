/** Shared with {@link redeemListingSlotPromoCoupon} — lives outside `"use server"` so Next can bundle server actions (non-async exports are invalid there). */
export type RedeemListingSlotPromoState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const initialRedeemListingSlotPromoState: RedeemListingSlotPromoState = { status: "idle" };
