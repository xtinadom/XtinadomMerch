import { getStoreTags } from "@/lib/store-tags";
import { getCartSession } from "@/lib/session";
import { cartBadgeQuantity } from "@/lib/cart-badge-quantity";
import { StoreNav } from "@/components/StoreNav";

export async function SiteHeader() {
  const tags = await getStoreTags();
  const cart = await getCartSession();
  const cartQty = await cartBadgeQuantity(cart.items);

  return <StoreNav tags={tags} cartQty={cartQty} />;
}
