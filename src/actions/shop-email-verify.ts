"use server";

import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { issueShopEmailVerificationTokenAndSend } from "@/lib/shop-email-verification";

export type ShopEmailVerifyMessage = { ok: true; message: string } | { ok: false; error: string };

export async function resendShopEmailVerification(): Promise<ShopEmailVerifyMessage> {
  const session = await getShopOwnerSession();
  if (!session.shopUserId) {
    return { ok: false, error: "Sign in to resend verification." };
  }

  const user = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    select: { id: true, email: true, emailVerifiedAt: true },
  });
  if (!user) {
    return { ok: false, error: "Account not found." };
  }
  if (user.emailVerifiedAt) {
    return { ok: false, error: "This email is already verified." };
  }

  const sent = await issueShopEmailVerificationTokenAndSend(user.id, user.email);
  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }
  return { ok: true, message: "Verification email sent. Check your inbox and spam folder." };
}
