"use client";

import { useEffect } from "react";
import type { CartCheckoutState } from "@/lib/cart-checkout-state";
import { CartAndCheckoutClient } from "@/components/CartAndCheckoutClient";

const DRAWER_SEED: CartCheckoutState = {
  lines: [],
  subtotalCents: 0,
  shippingCents: 0,
  taxCents: null,
  estimatedTotalCents: null,
  estimatedSalesTaxRate: null,
  tipAllowed: false,
};

export function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close cart"
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="store-dimension-panel animate-store-panel-in relative z-[2001] my-8 w-full max-w-xl shadow-2xl sm:my-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/95 px-6 py-4 backdrop-blur-md">
          <h2
            id="cart-drawer-title"
            className="text-lg font-semibold tracking-tight text-zinc-50"
          >
            Cart &amp; checkout
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="store-kicker rounded-md px-2 py-1 text-zinc-500 transition hover:bg-zinc-800/80 hover:text-zinc-200"
          >
            Close
          </button>
        </div>
        <CartAndCheckoutClient
          mode="drawer"
          initialState={DRAWER_SEED}
          open={open}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
