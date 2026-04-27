"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { CART_MAX_PRINTIFY_LINE_QTY } from "@/lib/cart-limits";
import { CheckoutForm } from "@/components/CheckoutForm";
import {
  updateCartLineFromForm,
  removeCartLineFromForm,
} from "@/actions/cart";
import type { CartCheckoutState } from "@/lib/cart-checkout-state";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function CartAndCheckoutClient({
  mode,
  initialState,
  open = true,
  onClose,
  fullCartHref = "/cart",
}: {
  mode: "page" | "drawer";
  initialState: CartCheckoutState;
  open?: boolean;
  onClose?: () => void;
  fullCartHref?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<CartCheckoutState>(initialState);
  const [loading, setLoading] = useState(mode === "drawer");
  const [pending, startTransition] = useTransition();

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/cart-state", { credentials: "same-origin" });
      const j = (await r.json()) as CartCheckoutState & { error?: string };
      if (!j.error && Array.isArray(j.lines)) {
        setState(j as CartCheckoutState);
      }
    } catch {
      // Offline or unreachable — keep showing last known cart state.
    }
  }, []);

  useEffect(() => {
    if (mode === "drawer") return;
    setState(initialState);
  }, [initialState, mode]);

  useEffect(() => {
    if (mode !== "drawer" || !open) return;
    setLoading(true);
    refetch().finally(() => setLoading(false));
  }, [mode, open, refetch]);

  const lines = state.lines;
  const subtotal = state.subtotalCents;
  const shippingCents = state.shippingCents;

  const handleQtySubmit = (formData: FormData) => {
    startTransition(async () => {
      await updateCartLineFromForm(formData);
      if (mode === "drawer") await refetch();
      router.refresh();
    });
  };

  const handleRemoveSubmit = (formData: FormData) => {
    startTransition(async () => {
      await removeCartLineFromForm(formData);
      if (mode === "drawer") await refetch();
      router.refresh();
    });
  };

  if (mode === "drawer" && loading) {
    return <p className="px-6 py-8 text-sm text-zinc-500">Loading cart…</p>;
  }

  if (lines.length === 0) {
    return (
      <div className={mode === "drawer" ? "px-6 py-6" : ""}>
        <p className="text-sm text-zinc-500">
          Your cart is empty.{" "}
          <Link
            href={SHOP_ALL_ROUTE}
            className="text-blue-400/90 hover:underline"
            onClick={onClose}
          >
            Browse products
          </Link>
        </p>
      </div>
    );
  }

  const inner = (
    <>
      <ul
        className={
          mode === "drawer"
            ? "divide-y divide-zinc-800/80 border-y border-zinc-800/80"
            : "divide-y divide-zinc-800/80 border-y border-zinc-800/80"
        }
      >
        {lines.map((l) => {
          const maxQty = CART_MAX_PRINTIFY_LINE_QTY;
          return (
            <li
              key={l.listingId}
              className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link
                  href={l.productHref}
                  scroll={false}
                  className="font-medium text-zinc-100 hover:text-blue-300"
                  onClick={onClose}
                >
                  {l.name}
                </Link>
                {l.primaryTagName ? (
                  <p className="store-kicker mt-1 text-zinc-500">{l.primaryTagName}</p>
                ) : null}
                {l.variantSub ? (
                  <p className="text-xs text-zinc-500">{l.variantSub}</p>
                ) : null}
                <p className="mt-1 text-sm text-zinc-400">
                  {formatPrice(l.unitCents)} each
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleQtySubmit(new FormData(e.currentTarget));
                  }}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="listingId" value={l.listingId} />
                  <input type="hidden" name="productId" value={l.productId} />
                  <label className="store-kicker text-zinc-500">
                    Qty
                    <input
                      type="number"
                      name="qty"
                      min={1}
                      max={maxQty}
                      defaultValue={l.quantity}
                      className="ml-2 w-16 rounded border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-sm text-zinc-100"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={pending}
                    className="store-kicker rounded-lg bg-zinc-800/90 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Update
                  </button>
                </form>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRemoveSubmit(new FormData(e.currentTarget));
                  }}
                >
                  <input type="hidden" name="listingId" value={l.listingId} />
                  <input type="hidden" name="productId" value={l.productId} />
                  <input type="hidden" name="slug" value={l.slug} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="store-kicker rounded-lg border border-zinc-700 px-3 py-1.5 text-blue-400/90 hover:border-blue-800/80 hover:bg-blue-950/40 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mx-auto mt-8 w-full max-w-md">
        <CheckoutForm
          tipAllowed={state.tipAllowed}
          subtotalCents={subtotal}
          shippingCents={shippingCents}
          estimatedSalesTaxRate={state.estimatedSalesTaxRate}
        />
      </div>

      {mode === "drawer" ? (
        <p className="mt-6 text-center">
          <Link
            href={fullCartHref}
            className="store-kicker text-zinc-500 hover:text-zinc-300"
            onClick={onClose}
          >
            Open cart on full page
          </Link>
        </p>
      ) : null}
    </>
  );

  if (mode === "drawer") {
    return <div className="px-6 pb-8 pt-2">{inner}</div>;
  }

  return <>{inner}</>;
}
