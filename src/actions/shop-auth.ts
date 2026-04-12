"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { hashShopPassword, verifyShopPassword } from "@/lib/shop-password";
import { slugify } from "@/lib/slugify";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

export type ShopAuthError = { error: string };

async function allocateShopSlugFromDisplayName(
  displayName: string,
): Promise<{ slug: string } | { error: string }> {
  const base = slugify(displayName);
  if (!base || base === PLATFORM_SHOP_SLUG) {
    return {
      error:
        "That shop name resolves to a reserved or invalid URL. Try a different name.",
    };
  }
  for (let n = 0; n < 40; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await prisma.shop.findUnique({ where: { slug: candidate } });
    if (!taken) return { slug: candidate };
  }
  return {
    error: "Could not allocate a unique shop URL from that name. Try a shorter or different name.",
  };
}

export async function createShopFromSignup(
  _prev: ShopAuthError | undefined,
  formData: FormData,
): Promise<ShopAuthError | undefined> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!displayName || displayName.length > 120) {
    return { error: "Display name is required (max 120 characters)." };
  }
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email." };
  }
  if (password.length < 10) {
    return { error: "Password must be at least 10 characters." };
  }

  const slugResult = await allocateShopSlugFromDisplayName(displayName);
  if ("error" in slugResult) {
    return { error: slugResult.error };
  }
  const { slug } = slugResult;
  const emailTaken = await prisma.shopUser.findUnique({ where: { email } });
  if (emailTaken) {
    return { error: "That email is already registered." };
  }

  const passwordHash = hashShopPassword(password);
  const shop = await prisma.shop.create({
    data: {
      slug,
      displayName,
      active: true,
    },
  });
  const user = await prisma.shopUser.create({
    data: { email, passwordHash, shopId: shop.id },
  });

  const session = await getShopOwnerSession();
  session.shopUserId = user.id;
  await session.save();
  redirect("/dashboard");
}

export async function loginShopOwner(
  _prev: ShopAuthError | undefined,
  formData: FormData,
): Promise<ShopAuthError | undefined> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await prisma.shopUser.findUnique({ where: { email } });
  if (!user || !verifyShopPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }

  const session = await getShopOwnerSession();
  session.shopUserId = user.id;
  await session.save();
  redirect("/dashboard");
}

export async function logoutShopOwner() {
  const session = await getShopOwnerSession();
  session.destroy();
  redirect("/");
}
