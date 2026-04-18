import { prisma } from "@/lib/prisma";
import {
  hashPasswordResetToken,
  newPasswordResetRawToken,
} from "@/lib/shop-password-reset-token";
import { sendShopEmailVerificationEmail } from "@/lib/send-shop-email-verification-email";

const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;

export async function issueShopEmailVerificationTokenAndSend(
  shopUserId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.shopEmailVerificationToken.deleteMany({
    where: { shopUserId, usedAt: null },
  });

  const raw = newPasswordResetRawToken();
  const tokenHash = hashPasswordResetToken(raw);
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);

  await prisma.shopEmailVerificationToken.create({
    data: { shopUserId, tokenHash, expiresAt },
  });

  const sent = await sendShopEmailVerificationEmail(email, raw);
  if (!sent.ok) {
    await prisma.shopEmailVerificationToken.deleteMany({ where: { tokenHash } });
    return { ok: false, error: sent.error };
  }
  return { ok: true };
}

export async function verifyShopEmailFromRawToken(
  rawToken: string | null | undefined,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const raw = (rawToken ?? "").trim();
  if (!raw) {
    return { ok: false, reason: "missing" };
  }

  const tokenHash = hashPasswordResetToken(raw);
  const row = await prisma.shopEmailVerificationToken.findUnique({
    where: { tokenHash },
    include: { shopUser: true },
  });

  if (!row || row.usedAt) {
    return { ok: false, reason: "invalid" };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  await prisma.$transaction([
    prisma.shopUser.update({
      where: { id: row.shopUserId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.shopEmailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.shopEmailVerificationToken.deleteMany({
      where: { shopUserId: row.shopUserId, usedAt: null, id: { not: row.id } },
    }),
  ]);

  return { ok: true };
}

/** Dev-only helper for previewing HTML layout. */
export function shopEmailVerificationPreviewDemoToken(): string {
  return "preview-email-verify-demo";
}
