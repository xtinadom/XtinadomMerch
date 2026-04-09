"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FulfillmentType } from "@/generated/prisma/enums";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { getCartSession } from "@/lib/session";
import { maxCartLineQty } from "@/lib/cart-limits";

export async function addToCart(
  productId: string,
  quantity = 1,
  printifyVariantId?: string | null,
): Promise<{ ok: true } | { ok: false }> {
  const session = await getCartSession();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product?.active) return { ok: false };

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

  const prev = session.items[productId];
  const prevQty = prev?.quantity ?? 0;
  const newQty = Math.min(lineMax, prevQty + q);

  session.items[productId] =
    vid !== undefined
      ? { quantity: newQty, printifyVariantId: vid }
      : { quantity: newQty };

  await session.save();
  revalidatePath("/cart", "layout");
  revalidatePath("/");
  revalidatePath("/product/" + product.slug);
  return { ok: true };
}

export async function setCartQuantity(productId: string, quantity: number) {
  const session = await getCartSession();
  if (quantity <= 0) {
    delete session.items[productId];
  } else {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { fulfillmentType: true },
    });
    const lineMax = maxCartLineQty(product?.fulfillmentType);
    const prev = session.items[productId];
    session.items[productId] = {
      quantity: Math.min(lineMax, quantity),
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
  await session.save();
  revalidatePath("/cart", "layout");
}

export async function updateCartLineFromForm(formData: FormData) {
  const productId = String(formData.get("productId") ?? "").trim();
  const qty = parseInt(String(formData.get("qty") ?? ""), 10);
  if (!productId || !Number.isFinite(qty)) return;
  await setCartQuantity(productId, qty);
}

export async function removeCartLineFromForm(formData: FormData) {
  const productId = String(formData.get("productId") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!productId) return;
  await setCartQuantity(productId, 0);
  if (slug) {
    revalidatePath("/product/" + slug);
  }
}
