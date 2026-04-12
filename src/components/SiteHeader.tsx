import { prisma } from "@/lib/prisma";
import { getStoreTags, getStoreTagsForShop } from "@/lib/store-tags";
import { getCartSessionReadonly, getShopOwnerSessionReadonly } from "@/lib/session";
import { cartBadgeQuantity } from "@/lib/cart-badge-quantity";
import { StoreNav } from "@/components/StoreNav";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

export async function SiteHeader({
  shopSlug,
  /** When false, hide the tag “Browse” dropdown (e.g. marketing home). Default true. */
  browseMenu = true,
}: { shopSlug?: string; browseMenu?: boolean } = {}) {
  const platform = !shopSlug || shopSlug === PLATFORM_SHOP_SLUG;
  const shop =
    !platform &&
    (await prisma.shop.findFirst({
      where: { slug: shopSlug, active: true },
      select: { id: true },
    }));
  const tags = browseMenu
    ? platform
      ? await getStoreTags()
      : shop
        ? await getStoreTagsForShop(shop.id)
        : await getStoreTags()
    : [];
  const cart = await getCartSessionReadonly();
  const cartQty = await cartBadgeQuantity(cart.items);

  const ownerSession = await getShopOwnerSessionReadonly();
  let shopOwnerEmail: string | undefined;
  let shopOwnerDisplayName: string | undefined;
  if (ownerSession.shopUserId) {
    const su = await prisma.shopUser.findUnique({
      where: { id: ownerSession.shopUserId },
      select: { email: true, shop: { select: { displayName: true } } },
    });
    shopOwnerEmail = su?.email;
    shopOwnerDisplayName = su?.shop.displayName?.trim() || undefined;
  }

  return (
    <StoreNav
      tags={tags}
      cartQty={cartQty}
      shopSlug={platform ? undefined : shopSlug}
      showBrowseMenu={browseMenu}
      shopOwnerEmail={shopOwnerEmail}
      shopOwnerDisplayName={shopOwnerDisplayName}
    />
  );
}
