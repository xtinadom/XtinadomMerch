"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import type { AdminCatalogVariant } from "@/lib/admin-catalog-item";
import {
  normalizeNewVariants,
  parseAdminCatalogVariantsJson,
  validateItemLevelWhenNoVariants,
} from "@/lib/admin-catalog-item";

function variantsJsonToStored(rawJson: string):
  | {
      variants: Prisma.InputJsonValue;
      variantCount: number;
    }
  | null {
  let parsed: unknown;
  try {
    parsed = rawJson ? (JSON.parse(rawJson) as unknown) : [];
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const candidates: {
    label: string;
    minPriceCents: number;
    goodsServicesCostCents: number;
    exampleListingUrl: string;
  }[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = String(o.label ?? "").trim();
    const minRaw = String(o.minPriceDollars ?? "").trim();
    const dollars = parseFloat(minRaw.replace(/[^0-9.]/g, ""));
    if (!label || !Number.isFinite(dollars) || dollars < 0) continue;
    const gsRaw = String(o.goodsServicesCostDollars ?? "").trim();
    let goodsServicesCostCents = 0;
    if (gsRaw.length > 0) {
      const g = parseFloat(gsRaw.replace(/[^0-9.]/g, ""));
      if (Number.isFinite(g) && g >= 0) goodsServicesCostCents = Math.round(g * 100);
    }
    candidates.push({
      label,
      minPriceCents: Math.round(dollars * 100),
      goodsServicesCostCents,
      exampleListingUrl: String(o.exampleListingUrl ?? "").trim(),
    });
  }
  const variants =
    candidates.length > 0 ? normalizeNewVariants(candidates) : [];
  return {
    variants: variants as unknown as Prisma.InputJsonValue,
    variantCount: variants.length,
  };
}

function itemLevelFromFormWhenNoVariants(formData: FormData):
  | { ok: true; itemExampleListingUrl: string | null; itemMinPriceCents: number; itemGoodsServicesCostCents: number }
  | { ok: false } {
  const itemEx = String(formData.get("itemExampleListingUrl") ?? "");
  const itemPrice = String(formData.get("itemMinPriceDollars") ?? "");
  const itemGs = String(formData.get("itemGoodsServicesCostDollars") ?? "");
  const v = validateItemLevelWhenNoVariants(itemEx, itemPrice, itemGs);
  if (!v.ok) return { ok: false };
  return {
    ok: true,
    itemExampleListingUrl: v.exampleListingUrl,
    itemMinPriceCents: v.minPriceCents,
    itemGoodsServicesCostCents: v.itemGoodsServicesCostCents,
  };
}

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

function catalogVariantsToStoredJson(variants: AdminCatalogVariant[]): Prisma.InputJsonValue {
  return variants.map((v) => {
    const row: Record<string, unknown> = {
      id: v.id,
      label: v.label,
      minPriceCents: v.minPriceCents,
      goodsServicesCostCents: v.goodsServicesCostCents ?? 0,
      exampleListingUrl: v.exampleListingUrl,
    };
    if (v.platformProductId) row.platformProductId = v.platformProductId;
    return row;
  }) as unknown as Prisma.InputJsonValue;
}

/**
 * Updates only the minimum price for an admin catalog row (item-level when there are no variants,
 * or one variant row when variants exist).
 */
export async function adminUpdateCatalogMinPrice(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const rawPrice = String(formData.get("minPriceDollars") ?? "").trim();
  const variantId = String(formData.get("variantId") ?? "").trim();
  const variantIndexRaw = String(formData.get("variantIndex") ?? "").trim();

  if (!itemId) return;

  const n = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return;

  const cents = Math.round(n * 100);

  const item = await prisma.adminCatalogItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  const variants = parseAdminCatalogVariantsJson(item.variants);

  if (variants.length === 0) {
    await prisma.adminCatalogItem.update({
      where: { id: itemId },
      data: { itemMinPriceCents: cents },
    });
    revalidatePath("/admin");
    return;
  }

  let idx = -1;
  if (variantId) {
    idx = variants.findIndex((v) => v.id === variantId);
  }
  if (idx < 0 && variantIndexRaw !== "") {
    const vi = Number.parseInt(variantIndexRaw, 10);
    if (Number.isFinite(vi) && vi >= 0 && vi < variants.length) idx = vi;
  }
  if (idx < 0) return;

  const next = variants.map((v, i) =>
    i === idx ? { ...v, minPriceCents: cents } : v,
  );
  await prisma.adminCatalogItem.update({
    where: { id: itemId },
    data: { variants: catalogVariantsToStoredJson(next) },
  });
  revalidatePath("/admin");
}

/**
 * Updates goods/services (fulfillment COGS) for an admin catalog row: item-level when there are no variants,
 * or one variant row when variants exist.
 */
export async function adminUpdateCatalogGoodsServicesCost(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const rawPrice = String(formData.get("goodsServicesCostDollars") ?? "").trim();
  const variantId = String(formData.get("variantId") ?? "").trim();
  const variantIndexRaw = String(formData.get("variantIndex") ?? "").trim();

  if (!itemId) return;

  const n = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return;

  const cents = Math.round(n * 100);

  const item = await prisma.adminCatalogItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  const variants = parseAdminCatalogVariantsJson(item.variants);

  if (variants.length === 0) {
    await prisma.adminCatalogItem.update({
      where: { id: itemId },
      data: { itemGoodsServicesCostCents: cents },
    });
    revalidatePath("/admin");
    return;
  }

  let idx = -1;
  if (variantId) {
    idx = variants.findIndex((v) => v.id === variantId);
  }
  if (idx < 0 && variantIndexRaw !== "") {
    const vi = Number.parseInt(variantIndexRaw, 10);
    if (Number.isFinite(vi) && vi >= 0 && vi < variants.length) idx = vi;
  }
  if (idx < 0) return;

  const next = variants.map((v, i) =>
    i === idx ? { ...v, goodsServicesCostCents: cents } : v,
  );
  await prisma.adminCatalogItem.update({
    where: { id: itemId },
    data: { variants: catalogVariantsToStoredJson(next) },
  });
  revalidatePath("/admin");
}

export async function adminAddCatalogItem(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("itemName") ?? "").trim();
  const rawJson = String(formData.get("variantsJson") ?? "").trim();
  if (!name) return;

  const parsed = variantsJsonToStored(rawJson);
  if (parsed === null) return;

  let itemExampleListingUrl: string | null = null;
  let itemMinPriceCents = 0;
  let itemGoodsServicesCostCents = 0;
  if (parsed.variantCount === 0) {
    const itemLevel = itemLevelFromFormWhenNoVariants(formData);
    if (!itemLevel.ok) return;
    itemExampleListingUrl = itemLevel.itemExampleListingUrl;
    itemMinPriceCents = itemLevel.itemMinPriceCents;
    itemGoodsServicesCostCents = itemLevel.itemGoodsServicesCostCents;
  }

  const maxSort = await prisma.adminCatalogItem.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  await prisma.adminCatalogItem.create({
    data: {
      name: name.slice(0, 300),
      sortOrder,
      variants: parsed.variants,
      itemPlatformProductId: null,
      itemExampleListingUrl,
      itemMinPriceCents,
      itemGoodsServicesCostCents,
    },
  });
  revalidatePath("/admin");
}

export async function adminUpdateCatalogItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("itemId") ?? "").trim();
  const name = String(formData.get("itemName") ?? "").trim();
  const rawJson = String(formData.get("variantsJson") ?? "").trim();
  if (!id || !name) return;

  const parsed = variantsJsonToStored(rawJson);
  if (parsed === null) return;

  let itemExampleListingUrl: string | null = null;
  let itemMinPriceCents = 0;
  let itemGoodsServicesCostCents = 0;
  if (parsed.variantCount === 0) {
    const itemLevel = itemLevelFromFormWhenNoVariants(formData);
    if (!itemLevel.ok) return;
    itemExampleListingUrl = itemLevel.itemExampleListingUrl;
    itemMinPriceCents = itemLevel.itemMinPriceCents;
    itemGoodsServicesCostCents = itemLevel.itemGoodsServicesCostCents;
  }

  const n = await prisma.adminCatalogItem.updateMany({
    where: { id },
    data: {
      name: name.slice(0, 300),
      variants: parsed.variants,
      itemPlatformProductId: null,
      itemExampleListingUrl,
      itemMinPriceCents,
      itemGoodsServicesCostCents: parsed.variantCount === 0 ? itemGoodsServicesCostCents : 0,
    },
  });
  if ((n?.count ?? 0) === 0) return;
  revalidatePath("/admin");
}

export async function adminDeleteCatalogItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("itemId") ?? "").trim();
  if (!id) return;
  await prisma.adminCatalogItem.deleteMany({ where: { id } });
  revalidatePath("/admin");
}
