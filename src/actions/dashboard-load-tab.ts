"use server";

import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { getShopOwnerSessionReadonly } from "@/lib/session";
import type { DashboardMainTabId } from "@/lib/dashboard-main-tab-id";
import { loadDashboardScopedChunks, scopeForTab } from "@/lib/dashboard-scoped-data";

/**
 * Fetch dashboard tab payload on demand (lazy tab). Same scopes as initial `?dash=` RSC load.
 */
export async function loadDashboardTabDataAction(tab: DashboardMainTabId) {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) {
    return { ok: false as const, error: "unauthorized" };
  }
  const row = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    select: { shop: { select: { id: true, slug: true } } },
  });
  if (!row?.shop) {
    return { ok: false as const, error: "unauthorized" };
  }
  const isPlatform = row.shop.slug === PLATFORM_SHOP_SLUG;
  const scopes = scopeForTab(tab, isPlatform);
  const data = await loadDashboardScopedChunks(row.shop.id, isPlatform, scopes);
  return { ok: true as const, data };
}
