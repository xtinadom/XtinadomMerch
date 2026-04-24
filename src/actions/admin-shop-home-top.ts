"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { getAdminSessionReadonly } from "@/lib/session";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export type AdminShopRankFormState = { ok: boolean; error: string | null };

export async function adminUpdateShopHomeRanking(
  _prev: AdminShopRankFormState,
  formData: FormData,
): Promise<AdminShopRankFormState> {
  await requireAdmin();
  const shopId = String(formData.get("shopId") ?? "").trim();
  if (!shopId) return { ok: false, error: "Missing shop." };

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { slug: true },
  });
  if (!shop || shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Invalid shop." };
  }

  const priorityRaw = String(formData.get("editorialPriority") ?? "").trim();
  let editorialPriority: number | null = null;
  if (priorityRaw !== "") {
    const n = Number.parseInt(priorityRaw, 10);
    if (!Number.isFinite(n)) {
      return { ok: false, error: "Editorial priority must be a whole number or empty." };
    }
    editorialPriority = n;
  }

  const pinnedRaw = String(formData.get("editorialPinnedUntil") ?? "").trim();
  let editorialPinnedUntil: Date | null = null;
  if (pinnedRaw) {
    const d = new Date(pinnedRaw);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: "Pinned until must be a valid ISO date/time or empty." };
    }
    editorialPinnedUntil = d;
  }

  await prisma.shop.update({
    where: { id: shopId },
    data: { editorialPriority, editorialPinnedUntil },
  });

  revalidatePath("/");
  revalidateAdminViews();
  return { ok: true, error: null };
}
