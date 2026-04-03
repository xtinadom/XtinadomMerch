"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FulfillmentType } from "@/generated/prisma/enums";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { getCartSession } from "@/lib/session";

export async function addToCart(
  productId: string,
  quantity = 1,
  printifyVariantId?: string | null,
) {
  const session = await getCartSession();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product?.active) return;

  const q = Math.max(1, Math.min(99, quantity));
  const variants = getPrintifyVariantsForProduct(product);
  let vid: string | undefined =
    typeof printifyVariantId === "string" && printifyVariantId.trim()
      ? printifyVariantId.trim()
      : undefined;

  if (product.fulfillmentType === FulfillmentType.printify) {
    if (variants.length > 1) {
      if (!vid || !variants.some((x) => x.id === vid)) return;
    } else if (variants.length === 1) {
      vid = variants[0].id;
    } else {
      return;
    }
  } else {
    vid = undefined;
  }

  const prev = session.items[productId];
  const prevQty = prev?.quantity ?? 0;
  const newQty = Math.min(99, prevQty + q);

  session.items[productId] =
    vid !== undefined
      ? { quantity: newQty, printifyVariantId: vid }
      : { quantity: newQty };

  await session.save();
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/shop");
  revalidatePath("/product/" + product.slug);
}

export async function setCartQuantity(productId: string, quantity: number) {
  const session = await getCartSession();
  if (quantity <= 0) {
    delete session.items[productId];
  } else {
    const prev = session.items[productId];
    session.items[productId] = {
      quantity: Math.min(99, quantity),
      ...(prev?.printifyVariantId
        ? { printifyVariantId: prev.printifyVariantId }
        : {}),
    };
  }
  await session.save();
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

export async function clearCart() {
  const session = await getCartSession();
  session.items = {};
  await session.save();
  revalidatePath("/cart");
  revalidatePath("/checkout");
}
