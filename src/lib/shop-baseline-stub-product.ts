import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Audience, FulfillmentType } from "@/generated/prisma/enums";
import type { ParsedBaselinePick } from "@/lib/shop-baseline-catalog";
import { computeBaselineStubSlug } from "@/lib/shop-baseline-stub-slug";

/** Picks that map to a single stub `Product` for a baseline listing request. */
export type BaselineStubPick = Extract<ParsedBaselinePick, { mode: "item" } | { mode: "variant" }>;

/** Unique per listing row so shops can list the same catalog line more than once. */
function uniqueListingStubSlug(shopId: string, itemId: string, variantKey: string): string {
  return `${computeBaselineStubSlug(shopId, itemId, variantKey)}-x${randomBytes(6).toString("hex")}`;
}

type ResolveBaselineResult = {
  displayName: string;
  minPriceCents: number;
  variantKey: string;
};

function resolveBaselineAgainstItem(item: { name: string; itemMinPriceCents: number }): ResolveBaselineResult | null {
  return {
    displayName: item.name.trim() || "Listing request",
    minPriceCents: Math.max(0, item.itemMinPriceCents),
    variantKey: "item",
  };
}

/**
 * Creates a new inactive stub `Product` for a baseline listing request (unique slug per submission —
 * avoids `ShopListing` @@unique([shopId, productId]) collisions).
 */
export async function createBaselineStubProductForNewListing(
  shopId: string,
  pick: BaselineStubPick,
): Promise<{ productId: string; minPriceCents: number } | null> {
  const row = await prisma.adminCatalogItem.findUnique({
    where: { id: pick.itemId },
  });
  if (!row) return null;
  const resolved = resolveBaselineAgainstItem(row);
  if (!resolved) return null;

  const slug = uniqueListingStubSlug(shopId, row.id, resolved.variantKey);
  const name = resolved.displayName.slice(0, 500);
  const minPriceCents = resolved.minPriceCents;
  const priceCents = Math.max(1, minPriceCents);

  const created = await prisma.product.create({
    data: {
      slug,
      name,
      description: null,
      priceCents,
      minPriceCents,
      audience: Audience.both,
      fulfillmentType: FulfillmentType.printify,
      active: false,
      primaryTagId: null,
    },
  });
  return { productId: created.id, minPriceCents };
}
