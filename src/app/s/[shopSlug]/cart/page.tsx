import Link from "next/link";
import { loadCartCheckoutState } from "@/lib/cart-checkout-state";
import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";
import { CartAndCheckoutClient } from "@/components/CartAndCheckoutClient";
import { shopAllProductsHref, shopCartHref } from "@/lib/marketplace-constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopSlug: string }> };

export default async function ShopTenantCartPage({ params }: Props) {
  const { shopSlug } = await params;
  const state = await loadCartCheckoutState();
  const back = shopAllProductsHref(shopSlug);
  const fullCart = shopCartHref(shopSlug);

  return (
    <StoreDocumentPanel
      backHref={back}
      backLabel="Continue shopping"
      title="Cart & checkout"
    >
      {state.lines.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Your cart is empty.{" "}
          <Link href={back} className="text-blue-400/90 hover:underline">
            Browse products
          </Link>
        </p>
      ) : (
        <CartAndCheckoutClient
          mode="page"
          initialState={state}
          fullCartHref={fullCart}
        />
      )}
    </StoreDocumentPanel>
  );
}
