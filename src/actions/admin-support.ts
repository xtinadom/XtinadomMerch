"use server";

import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { SupportMessageAuthor } from "@/generated/prisma/enums";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

const BODY_MAX = 10_000;

function normalizeBody(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s.length > BODY_MAX) return null;
  return s;
}

export async function adminSupportSendMessage(formData: FormData) {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const shopId = String(formData.get("shopId") ?? "").trim();
  const body = normalizeBody(formData.get("body"));
  if (!shopId || !body) return;

  const shop = await prisma.shop.findFirst({
    where: { id: shopId, slug: { not: PLATFORM_SHOP_SLUG } },
    select: { id: true },
  });
  if (!shop) return;

  const thread = await prisma.supportThread.upsert({
    where: { shopId: shop.id },
    create: { shopId: shop.id },
    update: {},
  });

  await prisma.supportMessage.create({
    data: {
      threadId: thread.id,
      authorRole: SupportMessageAuthor.admin,
      body,
    },
  });
  await prisma.supportThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });

  revalidateAdminViews();
}

export async function adminSupportMarkResolved(formData: FormData) {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const shopId = String(formData.get("shopId") ?? "").trim();
  if (!shopId) return;

  const shop = await prisma.shop.findFirst({
    where: { id: shopId, slug: { not: PLATFORM_SHOP_SLUG } },
    select: { id: true },
  });
  if (!shop) return;

  await prisma.supportThread.updateMany({
    where: { shopId: shop.id },
    data: { resolvedAt: new Date(), updatedAt: new Date() },
  });

  revalidateAdminViews();
}

export async function adminSupportMarkUnresolved(formData: FormData) {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const shopId = String(formData.get("shopId") ?? "").trim();
  if (!shopId) return;

  const shop = await prisma.shop.findFirst({
    where: { id: shopId, slug: { not: PLATFORM_SHOP_SLUG } },
    select: { id: true },
  });
  if (!shop) return;

  await prisma.supportThread.updateMany({
    where: { shopId: shop.id },
    data: { resolvedAt: null, updatedAt: new Date() },
  });

  revalidateAdminViews();
}
