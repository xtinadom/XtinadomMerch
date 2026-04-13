"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashShopPassword } from "@/lib/shop-password";
import {
  hashPasswordResetToken,
  newPasswordResetRawToken,
} from "@/lib/shop-password-reset-token";
import { sendShopPasswordResetEmail } from "@/lib/send-shop-password-reset-email";
import { getShopOwnerSession } from "@/lib/session";

export type ShopPasswordResetMessage = { ok: true; message: string } | { ok: false; error: string };

const RESET_TTL_MS = 2 * 60 * 60 * 1000;

/** Same copy whether or not the email exists (avoid account enumeration). */
const REQUEST_OK_MESSAGE =
  "If an account exists for that email, you will receive a link to reset your password shortly.";

export async function requestShopPasswordReset(
  _prev: ShopPasswordResetMessage | undefined,
  formData: FormData,
): Promise<ShopPasswordResetMessage> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const user = await prisma.shopUser.findUnique({ where: { email } });
  if (!user) {
    return { ok: true, message: REQUEST_OK_MESSAGE };
  }

  await prisma.shopPasswordResetToken.deleteMany({
    where: { shopUserId: user.id, usedAt: null },
  });

  const raw = newPasswordResetRawToken();
  const tokenHash = hashPasswordResetToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.shopPasswordResetToken.create({
    data: { shopUserId: user.id, tokenHash, expiresAt },
  });

  const sent = await sendShopPasswordResetEmail(email, raw);
  if (!sent.ok) {
    await prisma.shopPasswordResetToken.deleteMany({ where: { tokenHash } });
    return { ok: false, error: sent.error };
  }

  return { ok: true, message: REQUEST_OK_MESSAGE };
}

export async function resetShopPasswordWithToken(
  _prev: ShopPasswordResetMessage | undefined,
  formData: FormData,
): Promise<ShopPasswordResetMessage> {
  const rawToken = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("passwordConfirm") ?? "");

  if (!rawToken) {
    return { ok: false, error: "Missing reset link. Open the link from your email again." };
  }
  if (password.length < 10) {
    return { ok: false, error: "Password must be at least 10 characters." };
  }
  if (password !== password2) {
    return { ok: false, error: "Passwords do not match." };
  }

  const tokenHash = hashPasswordResetToken(rawToken);
  const row = await prisma.shopPasswordResetToken.findUnique({
    where: { tokenHash },
    include: { shopUser: true },
  });

  if (!row || row.usedAt != null || row.expiresAt < new Date()) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired. Request a new one from the login page.",
    };
  }

  const passwordHash = hashShopPassword(password);

  await prisma.$transaction([
    prisma.shopUser.update({
      where: { id: row.shopUserId },
      data: { passwordHash },
    }),
    prisma.shopPasswordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.shopPasswordResetToken.deleteMany({
      where: { shopUserId: row.shopUserId, usedAt: null, id: { not: row.id } },
    }),
  ]);

  const session = await getShopOwnerSession();
  session.shopUserId = row.shopUserId;
  await session.save();

  redirect("/dashboard");
}
