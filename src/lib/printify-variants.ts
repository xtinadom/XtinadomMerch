import type { Prisma } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import type { CartLine } from "@/lib/session";

export type StoredPrintifyVariant = {
  id: string;
  title: string;
  priceCents: number;
  imageUrl?: string | null;
  sku?: string | null;
};

function isGenericVariantTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (/^default$/i.test(t)) return true;
  if (/^default title$/i.test(t)) return true;
  if (/^variant \d+$/i.test(t)) return true;
  if (/^one size$/i.test(t)) return true;
  return false;
}

export function parsePrintifyVariantsJson(value: unknown): StoredPrintifyVariant[] {
  if (!Array.isArray(value)) return [];
  const out: StoredPrintifyVariant[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = o.id != null ? String(o.id).trim() : "";
    if (!id) continue;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const pcRaw = o.priceCents;
    let priceCents = 0;
    if (typeof pcRaw === "number" && Number.isFinite(pcRaw)) {
      priceCents = Math.max(0, Math.round(pcRaw));
    }
    if (priceCents <= 0) priceCents = 100;
    const imageUrl =
      typeof o.imageUrl === "string" && o.imageUrl.trim() ? o.imageUrl.trim() : null;
    const skuRaw = o.sku;
    const sku =
      typeof skuRaw === "string" && skuRaw.trim() ? skuRaw.trim() : null;
    out.push({ id, title: title || `Option ${id}`, priceCents, imageUrl, sku });
  }
  return out;
}

export function getPrintifyVariantsForProduct(product: {
  fulfillmentType: FulfillmentType;
  printifyVariants: Prisma.JsonValue | null;
  printifyVariantId: string | null;
  priceCents: number;
}): StoredPrintifyVariant[] {
  const parsed = parsePrintifyVariantsJson(product.printifyVariants);
  if (parsed.length > 0) return parsed;
  if (product.fulfillmentType !== FulfillmentType.printify) return [];
  if (product.printifyVariantId) {
    return [
      {
        id: product.printifyVariantId,
        title: "Default",
        priceCents: product.priceCents > 0 ? product.priceCents : 100,
        imageUrl: null,
      },
    ];
  }
  return [];
}

export function resolvePrintifyCheckoutLine(
  product: {
    name: string;
    priceCents: number;
    printifyVariantId: string | null;
    printifyVariants: Prisma.JsonValue | null;
    fulfillmentType: FulfillmentType;
  },
  cartLine: CartLine | undefined,
): { unitPriceCents: number; printifyVariantId: string; stripeName: string; variantTitle: string } | null {
  if (product.fulfillmentType !== FulfillmentType.printify) return null;
  const variants = getPrintifyVariantsForProduct(product);
  if (variants.length === 0) return null;
  const vid =
    cartLine?.printifyVariantId?.trim() ||
    product.printifyVariantId?.trim() ||
    variants[0]?.id;
  if (!vid) return null;
  const v = variants.find((x) => x.id === vid) ?? variants[0];
  if (!v) return null;
  const stripeName =
    variants.length > 1 && !isGenericVariantTitle(v.title)
      ? `${product.name} — ${v.title}`
      : product.name;
  return {
    unitPriceCents: v.priceCents,
    printifyVariantId: v.id,
    stripeName,
    variantTitle: v.title,
  };
}

export function cartLineUnitPriceCents(
  product: {
    name: string;
    fulfillmentType: FulfillmentType;
    priceCents: number;
    printifyVariantId: string | null;
    printifyVariants: Prisma.JsonValue | null;
  },
  cartLine: CartLine | undefined,
): number {
  if (product.fulfillmentType !== FulfillmentType.printify) return product.priceCents;
  const r = resolvePrintifyCheckoutLine(product, cartLine);
  return r?.unitPriceCents ?? product.priceCents;
}

export function cartLineVariantSubtitle(
  product: {
    fulfillmentType: FulfillmentType;
    name: string;
    priceCents: number;
    printifyVariantId: string | null;
    printifyVariants: Prisma.JsonValue | null;
  },
  cartLine: CartLine | undefined,
): string | undefined {
  if (product.fulfillmentType !== FulfillmentType.printify) return undefined;
  const variants = getPrintifyVariantsForProduct(product);
  if (variants.length <= 1) return undefined;
  const r = resolvePrintifyCheckoutLine(product, cartLine);
  if (!r || isGenericVariantTitle(r.variantTitle)) return undefined;
  return r.variantTitle;
}
