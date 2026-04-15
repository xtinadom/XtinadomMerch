import { prisma } from "@/lib/prisma";
import { Audience, FulfillmentType } from "@/generated/prisma/enums";
import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";
import type { ParsedBaselinePick } from "@/lib/shop-baseline-catalog";
import {
  BASELINE_ALL_VARIANTS_STUB_KEY,
  computeBaselineStubSlug,
} from "@/lib/shop-baseline-stub-slug";

export { BASELINE_ALL_VARIANTS_STUB_KEY, computeBaselineStubSlug };

/** Picks that map to a single stub `Product` (not whole multi-variant submissions). */
export type BaselineStubPick = Extract<
  ParsedBaselinePick,
  { mode: "item" } | { mode: "variant" }
>;

type ResolveBaselineResult = {
  displayName: string;
  minPriceCents: number;
  variantKey: string;
};

function resolveBaselineAgainstItem(
  item: { name: string; variants: unknown; itemMinPriceCents: number },
  pick: BaselineStubPick,
): ResolveBaselineResult | null {
  const variants = parseAdminCatalogVariantsJson(item.variants);
  if (pick.mode === "item") {
    if (variants.length > 0) return null;
    return {
      displayName: item.name.trim() || "Listing request",
      minPriceCents: Math.max(0, item.itemMinPriceCents),
      variantKey: "item",
    };
  }
  const v = variants.find((x) => x.id === pick.variantId);
  if (!v) return null;
  return {
    displayName: `${item.name} — ${v.label}`.trim() || "Listing request",
    minPriceCents: Math.max(0, v.minPriceCents),
    variantKey: `var:${v.id}`,
  };
}

/**
 * Ensures a manual, inactive Product exists for this shop + admin baseline line (deterministic slug).
 */
export async function getOrCreateBaselineStubProduct(
  shopId: string,
  pick: BaselineStubPick,
): Promise<{ productId: string; minPriceCents: number } | null> {
  const row = await prisma.adminCatalogItem.findUnique({
    where: { id: pick.itemId },
  });
  if (!row) return null;
  const resolved = resolveBaselineAgainstItem(row, pick);
  if (!resolved) return null;

  const slug = computeBaselineStubSlug(shopId, row.id, resolved.variantKey);
  const name = resolved.displayName.slice(0, 500);
  const minPriceCents = resolved.minPriceCents;
  const priceCents = Math.max(1, minPriceCents);

  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        name,
        minPriceCents,
        priceCents: Math.max(priceCents, existing.priceCents),
      },
    });
    return { productId: existing.id, minPriceCents };
  }

  const created = await prisma.product.create({
    data: {
      slug,
      name,
      description: null,
      priceCents,
      minPriceCents,
      audience: Audience.both,
      fulfillmentType: FulfillmentType.manual,
      active: false,
      primaryTagId: null,
    },
  });
  return { productId: created.id, minPriceCents };
}

/**
 * One inactive stub `Product` for “submit all sizes together” baseline picks (single shop listing, multi price).
 */
export async function getOrCreateBaselineAllVariantsStubProduct(
  shopId: string,
  itemId: string,
): Promise<{ productId: string; minPriceCents: number } | null> {
  const row = await prisma.adminCatalogItem.findUnique({
    where: { id: itemId },
  });
  if (!row) return null;
  const variants = parseAdminCatalogVariantsJson(row.variants);
  if (variants.length === 0) return null;

  const slug = computeBaselineStubSlug(shopId, row.id, BASELINE_ALL_VARIANTS_STUB_KEY);
  const name = row.name.trim() || "Listing request";
  let minPriceCents = Math.max(0, variants[0]!.minPriceCents);
  for (const v of variants) {
    minPriceCents = Math.min(minPriceCents, Math.max(0, v.minPriceCents));
  }
  const priceCents = Math.max(1, minPriceCents);

  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        name,
        minPriceCents,
        priceCents: Math.max(priceCents, existing.priceCents),
      },
    });
    return { productId: existing.id, minPriceCents };
  }

  const created = await prisma.product.create({
    data: {
      slug,
      name,
      description: null,
      priceCents,
      minPriceCents,
      audience: Audience.both,
      fulfillmentType: FulfillmentType.manual,
      active: false,
      primaryTagId: null,
    },
  });
  return { productId: created.id, minPriceCents };
}
