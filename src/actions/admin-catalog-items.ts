"use server";

import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import {
  parseAdminCatalogArtworkRequirement,
  validateItemLevelWhenNoVariants,
} from "@/lib/admin-catalog-item";
import { syncProductTagsFromAdminCatalogItemId } from "@/lib/baseline-listing-product-tags-sync";

const EMPTY_VARIANTS_JSON = [] as unknown as Prisma.InputJsonValue;

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

function itemLevelFromFormWhenNoVariants(formData: FormData):
  | {
      ok: true;
      itemExampleListingUrl: string | null;
      itemMinPriceCents: number;
      itemGoodsServicesCostCents: number;
      itemImageRequirementLabel: string | null;
      itemMinArtworkLongEdgePx: number | null;
    }
  | { ok: false } {
  const itemEx = String(formData.get("itemExampleListingUrl") ?? "");
  const itemPrice = String(formData.get("itemMinPriceDollars") ?? "");
  const itemGs = String(formData.get("itemGoodsServicesCostDollars") ?? "");
  const v = validateItemLevelWhenNoVariants(itemEx, itemPrice, itemGs);
  if (!v.ok) return { ok: false };
  const ar = parseAdminCatalogArtworkRequirement(
    String(formData.get("itemImageRequirementLabel") ?? ""),
    String(formData.get("itemMinArtworkLongEdgePx") ?? ""),
  );
  if (!ar.ok) return { ok: false };
  return {
    ok: true,
    itemExampleListingUrl: v.exampleListingUrl,
    itemMinPriceCents: v.minPriceCents,
    itemGoodsServicesCostCents: v.itemGoodsServicesCostCents,
    itemImageRequirementLabel: ar.itemImageRequirementLabel,
    itemMinArtworkLongEdgePx: ar.itemMinArtworkLongEdgePx,
  };
}

export async function adminAddCatalogItem(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("itemName") ?? "").trim();
  if (!name) return;

  const itemLevel = itemLevelFromFormWhenNoVariants(formData);
  if (!itemLevel.ok) return;

  const maxSort = await prisma.adminCatalogItem.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  await prisma.adminCatalogItem.create({
    data: {
      name: name.slice(0, 300),
      sortOrder,
      variants: EMPTY_VARIANTS_JSON,
      itemPlatformProductId: null,
      itemExampleListingUrl: itemLevel.itemExampleListingUrl,
      itemMinPriceCents: itemLevel.itemMinPriceCents,
      itemGoodsServicesCostCents: itemLevel.itemGoodsServicesCostCents,
      itemImageRequirementLabel: itemLevel.itemImageRequirementLabel,
      itemMinArtworkLongEdgePx: itemLevel.itemMinArtworkLongEdgePx,
    },
  });
  revalidateAdminViews();
}

export async function adminUpdateCatalogItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("itemId") ?? "").trim();
  const name = String(formData.get("itemName") ?? "").trim();
  if (!id || !name) return;

  const itemLevel = itemLevelFromFormWhenNoVariants(formData);
  if (!itemLevel.ok) return;

  const n = await prisma.adminCatalogItem.updateMany({
    where: { id },
    data: {
      name: name.slice(0, 300),
      variants: EMPTY_VARIANTS_JSON,
      itemPlatformProductId: null,
      itemExampleListingUrl: itemLevel.itemExampleListingUrl,
      itemMinPriceCents: itemLevel.itemMinPriceCents,
      itemGoodsServicesCostCents: itemLevel.itemGoodsServicesCostCents,
      itemImageRequirementLabel: itemLevel.itemImageRequirementLabel,
      itemMinArtworkLongEdgePx: itemLevel.itemMinArtworkLongEdgePx,
    },
  });
  if ((n?.count ?? 0) === 0) return;
  revalidateAdminViews();
}

export async function adminDeleteCatalogItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("itemId") ?? "").trim();
  if (!id) return;
  await prisma.adminCatalogItem.deleteMany({ where: { id } });
  revalidateAdminViews();
}

export async function adminLinkCatalogItemTag(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const tagId = String(formData.get("tagId") ?? "").trim();
  if (!itemId || !tagId) return;

  const [item, tag] = await Promise.all([
    prisma.adminCatalogItem.findUnique({ where: { id: itemId }, select: { id: true } }),
    prisma.tag.findUnique({ where: { id: tagId }, select: { id: true } }),
  ]);
  if (!item || !tag) return;

  await prisma.adminCatalogItemTag.upsert({
    where: { adminCatalogItemId_tagId: { adminCatalogItemId: itemId, tagId } },
    create: { adminCatalogItemId: itemId, tagId },
    update: {},
  });
  await syncProductTagsFromAdminCatalogItemId(itemId);
  revalidateAdminViews();
}

export async function adminUnlinkCatalogItemTag(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const tagId = String(formData.get("tagId") ?? "").trim();
  if (!itemId || !tagId) return;

  await prisma.adminCatalogItemTag.deleteMany({
    where: { adminCatalogItemId: itemId, tagId },
  });
  await syncProductTagsFromAdminCatalogItemId(itemId);
  revalidateAdminViews();
}
