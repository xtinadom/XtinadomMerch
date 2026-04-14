"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";

async function requireShopOwner() {
  const session = await getShopOwnerSession();
  if (!session.shopUserId) redirect("/dashboard/login");
  const user = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    include: { shop: true },
  });
  if (!user) {
    session.destroy();
    redirect("/dashboard/login");
  }
  return user;
}

async function markOwnerNoticeReadForCurrentShop(formData: FormData) {
  const user = await requireShopOwner();
  const noticeId = String(formData.get("noticeId") ?? "").trim();
  if (!noticeId) return;
  await prisma.shopOwnerNotice.updateMany({
    where: { id: noticeId, shopId: user.shopId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard");
}

/** Marks a notice read (Notifications tab — “Mark as read”). */
export async function dashboardMarkOwnerNoticeRead(formData: FormData) {
  await markOwnerNoticeReadForCurrentShop(formData);
}
