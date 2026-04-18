"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { hashShopPassword, verifyShopPassword } from "@/lib/shop-password";
import { allocateUniqueShopSlug } from "@/lib/shop-slug";
import { issueShopEmailVerificationTokenAndSend } from "@/lib/shop-email-verification";

export type ShopAuthError = { error: string };

export async function createShopFromSignup(
  _prev: ShopAuthError | undefined,
  formData: FormData,
): Promise<ShopAuthError | undefined> {
  const username = String(formData.get("username") ?? "").trim();
  const displayNameOpt = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || username.length > 80) {
    return { error: "Username is required (max 80 characters). It becomes your shop URL." };
  }
  const displayName = displayNameOpt || username;
  if (!displayName || displayName.length > 120) {
    return { error: "Shop display name must be at most 120 characters." };
  }
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email." };
  }
  if (password.length < 10) {
    return { error: "Password must be at least 10 characters." };
  }

  const slugResult = await allocateUniqueShopSlug(username);
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

  const verifySend = await issueShopEmailVerificationTokenAndSend(user.id, email);
  if (!verifySend.ok) {
    console.error("[create-shop] verification email failed:", verifySend.error);
  }

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
