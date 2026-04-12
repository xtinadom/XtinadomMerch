"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { normalizeNewVariants, validateItemLevelWhenNoVariants } from "@/lib/admin-catalog-item";

function variantsJsonToStored(rawJson: string):
  | {
      variants: Prisma.InputJsonValue;
      variantCount: number;
      variantPlatformProductIds: string[];
    }
  | null {
  let parsed: unknown;
  try {
    parsed = rawJson ? (JSON.parse(rawJson) as unknown) : [];
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const variantPlatformProductIds: string[] = [];
  const candidates: {
    label: string;
    minPriceCents: number;
    exampleListingUrl: string;
    platformProductId?: string;
  }[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = String(o.label ?? "").trim();
    const minRaw = String(o.minPriceDollars ?? "").trim();
    const dollars = parseFloat(minRaw.replace(/[^0-9.]/g, ""));
    if (!label || !Number.isFinite(dollars) || dollars < 0) continue;
    const platformProductId = String(o.platformProductId ?? "").trim();
    if (platformProductId) variantPlatformProductIds.push(platformProductId);
    candidates.push({
      label,
      minPriceCents: Math.round(dollars * 100),
      exampleListingUrl: String(o.exampleListingUrl ?? "").trim(),
      ...(platformProductId ? { platformProductId } : {}),
    });
  }
  const variants =
    candidates.length > 0 ? normalizeNewVariants(candidates) : [];
  return {
    variants: variants as unknown as Prisma.InputJsonValue,
    variantCount: variants.length,
    variantPlatformProductIds,
  };
}

function itemPlatformProductIdFromForm(formData: FormData): string | null {
  const v = String(formData.get("itemPlatformProductId") ?? "").trim();
  return v || null;
}

async function assertAllPrintifyProductIdsValid(
  ids: (string | null | undefined)[],
): Promise<boolean> {
  const uniq = [...new Set(ids.map((x) => String(x ?? "").trim()).filter(Boolean))];
  if (uniq.length === 0) return true;
  const n = await prisma.product.count({
    where: {
      id: { in: uniq },
      active: true,
      fulfillmentType: FulfillmentType.printify,
    },
  });
  return n === uniq.length;
}

function itemLevelFromFormWhenNoVariants(formData: FormData):
  | { ok: true; itemExampleListingUrl: string | null; itemMinPriceCents: number }
  | { ok: false } {
  const itemEx = String(formData.get("itemExampleListingUrl") ?? "");
  const itemPrice = String(formData.get("itemMinPriceDollars") ?? "");
  const v = validateItemLevelWhenNoVariants(itemEx, itemPrice);
  if (!v.ok) return { ok: false };
  return {
    ok: true,
    itemExampleListingUrl: v.exampleListingUrl,
    itemMinPriceCents: v.minPriceCents,
  };
}

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.isAdmin) redirect("/admin/login");
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
  let itemPlatformProductId: string | null = null;
  if (parsed.variantCount === 0) {
    const itemLevel = itemLevelFromFormWhenNoVariants(formData);
    if (!itemLevel.ok) return;
    itemExampleListingUrl = itemLevel.itemExampleListingUrl;
    itemMinPriceCents = itemLevel.itemMinPriceCents;
    itemPlatformProductId = itemPlatformProductIdFromForm(formData);
  }

  const okIds = await assertAllPrintifyProductIdsValid([
    itemPlatformProductId,
    ...parsed.variantPlatformProductIds,
  ]);
  if (!okIds) return;

  const maxSort = await prisma.adminCatalogItem.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  await prisma.adminCatalogItem.create({
    data: {
      name: name.slice(0, 300),
      sortOrder,
      variants: parsed.variants,
      itemPlatformProductId,
      itemExampleListingUrl,
      itemMinPriceCents,
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
  let itemPlatformProductId: string | null = null;
  if (parsed.variantCount === 0) {
    const itemLevel = itemLevelFromFormWhenNoVariants(formData);
    if (!itemLevel.ok) return;
    itemExampleListingUrl = itemLevel.itemExampleListingUrl;
    itemMinPriceCents = itemLevel.itemMinPriceCents;
    itemPlatformProductId = itemPlatformProductIdFromForm(formData);
  }

  const okIds = await assertAllPrintifyProductIdsValid([
    itemPlatformProductId,
    ...parsed.variantPlatformProductIds,
  ]);
  if (!okIds) return;

  const n = await prisma.adminCatalogItem.updateMany({
    where: { id },
    data: {
      name: name.slice(0, 300),
      variants: parsed.variants,
      itemPlatformProductId,
      itemExampleListingUrl,
      itemMinPriceCents,
    },
  });
  if (n.count === 0) return;
  revalidatePath("/admin");
}

export async function adminDeleteCatalogItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("itemId") ?? "").trim();
  if (!id) return;
  await prisma.adminCatalogItem.deleteMany({ where: { id } });
  revalidatePath("/admin");
}
