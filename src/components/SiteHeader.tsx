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
  let tags: Awaited<ReturnType<typeof getStoreTags>> = [];
  let cartQty = 0;
  let shopOwnerEmail: string | undefined;
  let shopOwnerDisplayName: string | undefined;

  try {
    let shop: { id: string } | null = null;
    if (!platform && shopSlug) {
      shop = await prisma.shop.findFirst({
        where: { slug: shopSlug, active: true },
        select: { id: true },
      });
    }

    const tagsPromise = browseMenu
      ? platform
        ? getStoreTags()
        : shop
          ? getStoreTagsForShop(shop.id)
          : getStoreTags()
      : Promise.resolve<
          Awaited<ReturnType<typeof getStoreTags>>
        >([]);

    const [tagsResolved, cart, ownerSession] = await Promise.all([
      tagsPromise,
      getCartSessionReadonly(),
      getShopOwnerSessionReadonly(),
    ]);
    tags = tagsResolved;

    const ownerLookup =
      ownerSession.shopUserId != null
        ? prisma.shopUser.findUnique({
            where: { id: ownerSession.shopUserId },
            select: { email: true, shop: { select: { displayName: true } } },
          })
        : Promise.resolve(null);

    const [qty, su] = await Promise.all([
      cartBadgeQuantity(cart.items),
      ownerLookup,
    ]);
    cartQty = qty;
    if (su) {
      shopOwnerEmail = su.email;
      shopOwnerDisplayName = su.shop.displayName?.trim() || undefined;
    }
  } catch (e) {
    console.error("[SiteHeader]", e);
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
