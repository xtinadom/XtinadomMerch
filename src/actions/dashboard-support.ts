"use server";

import { revalidatePath } from "next/cache";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { SupportMessageAuthor } from "@/generated/prisma/enums";

const BODY_MAX = 10_000;

function normalizeBody(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s.length > BODY_MAX) return null;
  return s;
}

export async function dashboardSupportSendMessage(formData: FormData) {
  const session = await getShopOwnerSession();
  if (!session.shopUserId) redirect("/dashboard/login");

  const user = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    select: { shopId: true },
  });
  if (!user) redirect("/dashboard/login");

  const body = normalizeBody(formData.get("body"));
  if (!body) return;

  const thread = await prisma.supportThread.upsert({
    where: { shopId: user.shopId },
    create: { shopId: user.shopId },
    update: {},
  });

  await prisma.supportMessage.create({
    data: {
      threadId: thread.id,
      authorRole: SupportMessageAuthor.creator,
      body,
    },
  });
  await prisma.supportThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date(), resolvedAt: null },
  });

  revalidatePath("/dashboard");
  revalidateAdminViews();
}
