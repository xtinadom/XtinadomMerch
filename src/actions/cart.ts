"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FulfillmentType } from "@/generated/prisma/enums";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { getCartSession } from "@/lib/session";
import { maxCartLineQty } from "@/lib/cart-limits";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

async function resolveActiveListing(
  productOrListingId: string,
  shopSlug?: string | null,
) {
  if (productOrListingId.startsWith("sl_")) {
    return prisma.shopListing.findFirst({
      where: { id: productOrListingId, active: true },
      include: { product: true, shop: { select: { id: true, slug: true } } },
    });
  }
  const slug = shopSlug?.trim() || PLATFORM_SHOP_SLUG;
  return prisma.shopListing.findFirst({
    where: {
      productId: productOrListingId,
      shop: { slug },
      active: true,
    },
    include: { product: true, shop: { select: { id: true, slug: true } } },
  });
}

export async function addToCart(
  productOrListingId: string,
  quantity = 1,
  printifyVariantId?: string | null,
  shopSlug?: string | null,
): Promise<{ ok: true } | { ok: false }> {
  const session = await getCartSession();
  const listing = await resolveActiveListing(productOrListingId, shopSlug);
  if (!listing?.product.active) return { ok: false };

  const product = listing.product;
  const lineMax = maxCartLineQty(product.fulfillmentType);
  const q = Math.max(1, Math.min(lineMax, quantity));
  const variants = getPrintifyVariantsForProduct(product);
  let vid: string | undefined =
    typeof printifyVariantId === "string" && printifyVariantId.trim()
      ? printifyVariantId.trim()
      : undefined;

  if (product.fulfillmentType === FulfillmentType.printify) {
    if (variants.length > 1) {
      if (!vid || !variants.some((x) => x.id === vid)) return { ok: false };
    } else if (variants.length === 1) {
      vid = variants[0].id;
    } else {
      return { ok: false };
    }
  } else {
    vid = undefined;
  }

  const keys = Object.keys(session.items).filter(
    (k) => (session.items[k]?.quantity ?? 0) > 0,
  );
  if (keys.length > 0 && session.shopId && session.shopId !== listing.shopId) {
    return { ok: false };
  }

  const listingId = listing.id;
  const prev = session.items[listingId];
  const prevQty = prev?.quantity ?? 0;
  const newQty = Math.min(lineMax, prevQty + q);

  session.items[listingId] =
    vid !== undefined
      ? { quantity: newQty, printifyVariantId: vid }
      : { quantity: newQty };
  session.shopId = listing.shopId;

  await session.save();
  revalidatePath("/cart", "layout");
  revalidatePath("/");
  revalidatePath("/product/" + product.slug);
  revalidatePath(`/s/${listing.shop.slug}/product/${product.slug}`);
  return { ok: true };
}

export async function setCartQuantity(listingId: string, quantity: number) {
  const session = await getCartSession();
  if (quantity <= 0) {
    delete session.items[listingId];
    if (Object.keys(session.items).every((k) => (session.items[k]?.quantity ?? 0) <= 0)) {
      session.shopId = null;
    }
  } else {
    const listing = await prisma.shopListing.findUnique({
      where: { id: listingId },
      include: { product: { select: { fulfillmentType: true } } },
    });
    const lineMax = maxCartLineQty(listing?.product.fulfillmentType);
    const prev = session.items[listingId];
    session.items[listingId] = {
      quantity: Math.min(lineMax ?? 99, quantity),
      ...(prev?.printifyVariantId
        ? { printifyVariantId: prev.printifyVariantId }
        : {}),
    };
  }
  await session.save();
  revalidatePath("/cart", "layout");
  revalidatePath("/");
}

export async function clearCart() {
  const session = await getCartSession();
  session.items = {};
  session.shopId = null;
  await session.save();
  revalidatePath("/cart", "layout");
}

export async function updateCartLineFromForm(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "").trim();
  const legacyProductId = String(formData.get("productId") ?? "").trim();
  const id = listingId || legacyProductId;
  const qty = parseInt(String(formData.get("qty") ?? ""), 10);
  if (!id || !Number.isFinite(qty)) return;
  await setCartQuantity(id, qty);
}

export async function removeCartLineFromForm(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "").trim();
  const legacyProductId = String(formData.get("productId") ?? "").trim();
  const id = listingId || legacyProductId;
  const slug = String(formData.get("slug") ?? "").trim();
  if (!id) return;
  await setCartQuantity(id, 0);
  if (slug) {
    revalidatePath("/product/" + slug);
  }
}
