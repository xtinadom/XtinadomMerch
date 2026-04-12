import Link from "next/link";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { loadCartCheckoutState } from "@/lib/cart-checkout-state";
import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";
import { CartAndCheckoutClient } from "@/components/CartAndCheckoutClient";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const state = await loadCartCheckoutState();

  return (
    <StoreDocumentPanel
      backHref={SHOP_ALL_ROUTE}
      backLabel="Continue shopping"
      title="Cart & checkout"
    >
      {state.lines.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Your cart is empty.{" "}
          <Link href={SHOP_ALL_ROUTE} className="text-blue-400/90 hover:underline">
            Browse products
          </Link>
        </p>
      ) : (
        <CartAndCheckoutClient mode="page" initialState={state} fullCartHref="/cart" />
      )}
    </StoreDocumentPanel>
  );
}
