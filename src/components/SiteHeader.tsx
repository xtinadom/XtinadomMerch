import { getStoreTags } from "@/lib/store-tags";
import { getCartSessionReadonly } from "@/lib/session";
import { cartBadgeQuantity } from "@/lib/cart-badge-quantity";
import { StoreNav } from "@/components/StoreNav";

export async function SiteHeader() {
  const tags = await getStoreTags();
  const cart = await getCartSessionReadonly();
  const cartQty = await cartBadgeQuantity(cart.items);

  return <StoreNav tags={tags} cartQty={cartQty} />;
}
