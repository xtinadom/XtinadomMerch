import { prisma } from "@/lib/prisma";
import {
  hashPasswordResetToken,
  newPasswordResetRawToken,
} from "@/lib/shop-password-reset-token";
import { sendShopAccountDeletionConfirmEmail } from "@/lib/send-shop-account-deletion-email";

const DELETION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function issueShopAccountDeletionTokenAndSend(
  shopUserId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.shopAccountDeletionToken.deleteMany({
    where: { shopUserId, usedAt: null },
  });

  const raw = newPasswordResetRawToken();
  const tokenHash = hashPasswordResetToken(raw);
  const expiresAt = new Date(Date.now() + DELETION_TOKEN_TTL_MS);

  await prisma.shopAccountDeletionToken.create({
    data: { shopUserId, tokenHash, expiresAt },
  });

  const sent = await sendShopAccountDeletionConfirmEmail(email, raw);
  if (!sent.ok) {
    await prisma.shopAccountDeletionToken.deleteMany({ where: { tokenHash } });
    return { ok: false, error: sent.error };
  }
  return { ok: true };
}

export async function confirmShopAccountDeletionFromRawToken(
  rawToken: string | null | undefined,
): Promise<{ ok: true; shopUserId: string; shopId: string } | { ok: false; reason: string }> {
  const raw = (rawToken ?? "").trim();
  if (!raw) {
    return { ok: false, reason: "missing" };
  }

  const tokenHash = hashPasswordResetToken(raw);
  const row = await prisma.shopAccountDeletionToken.findUnique({
    where: { tokenHash },
    include: { shopUser: { select: { id: true, shopId: true } } },
  });

  if (!row || row.usedAt) {
    return { ok: false, reason: "invalid" };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  await prisma.$transaction([
    prisma.shop.update({
      where: { id: row.shopUser.shopId },
      data: { accountDeletionEmailConfirmedAt: new Date() },
    }),
    prisma.shopAccountDeletionToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.shopAccountDeletionToken.deleteMany({
      where: { shopUserId: row.shopUserId, usedAt: null, id: { not: row.id } },
    }),
  ]);

  return { ok: true, shopUserId: row.shopUserId, shopId: row.shopUser.shopId };
}
