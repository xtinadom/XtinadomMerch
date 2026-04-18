import type { Prisma } from "@/generated/prisma/client";
import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";
import { parseListingPrintifyVariantPrices } from "@/lib/listing-printify-variant-prices";
import { parsePrintifyVariantsJson, type StoredPrintifyVariant } from "@/lib/printify-variants";
import { prisma } from "@/lib/prisma";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import {
  BASELINE_ALL_VARIANTS_STUB_KEY,
  computeBaselineStubSlug,
} from "@/lib/shop-baseline-stub-slug";

function normalizeTitle(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function labelMatchesPrintifyTitle(catalogLabel: string, printifyTitle: string): boolean {
  const a = normalizeTitle(catalogLabel);
  const b = normalizeTitle(printifyTitle);
  if (a.length < 2 || b.length < 2) return false;
  if (b.includes(a) || a.includes(b)) return true;
  const tokens = (t: string) =>
    new Set(
      t
        .split(/[^a-z0-9]+/g)
        .map((x) => x.trim())
        .filter((x) => x.length > 1),
    );
  const ta = tokens(a);
  const tb = tokens(b);
  let overlap = 0;
  for (const x of ta) {
    if (tb.has(x)) overlap++;
  }
  return overlap >= 2 || (overlap === 1 && ta.size <= 4 && tb.size <= 8);
}

function mapCatalogPricesToPrintifyVariantIds(
  catalogVariants: { id: string; label: string }[],
  printifyVariants: StoredPrintifyVariant[],
  catalogCentsById: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  const usedPrintify = new Set<string>();
  const mappedCatalogIds = new Set<string>();

  for (const cv of catalogVariants) {
    const cents = catalogCentsById[cv.id];
    if (cents == null) continue;
    const match = printifyVariants.find(
      (p) => !usedPrintify.has(p.id) && labelMatchesPrintifyTitle(cv.label, p.title),
    );
    if (match) {
      out[match.id] = cents;
      usedPrintify.add(match.id);
      mappedCatalogIds.add(cv.id);
    }
  }

  const unmappedCatalog = catalogVariants.filter(
    (cv) => catalogCentsById[cv.id] != null && !mappedCatalogIds.has(cv.id),
  );
  const unmappedPrintify = printifyVariants.filter((p) => !usedPrintify.has(p.id));
  for (let i = 0; i < Math.min(unmappedCatalog.length, unmappedPrintify.length); i++) {
    const cv = unmappedCatalog[i]!;
    const p = unmappedPrintify[i]!;
    out[p.id] = catalogCentsById[cv.id]!;
    usedPrintify.add(p.id);
  }

  return out;
}

/**
 * After Printify sync, rewrite `listingPrintifyVariantPrices` keys from admin-catalog variant ids → Printify variant ids
 * for consolidated “all variants” baseline listings.
 */
export async function remapShopListingCatalogVariantPricesAfterPrintifySync(
  productId: string,
): Promise<void> {
  const listing = await prisma.shopListing.findFirst({
    where: { productId },
    select: {
      id: true,
      shopId: true,
      listingPrintifyVariantPrices: true,
      baselineCatalogPickEncoded: true,
    },
  });
  if (!listing) return;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true, printifyVariants: true },
  });
  if (!product?.slug) return;

  const printifyParsed = parsePrintifyVariantsJson(product.printifyVariants);
  if (printifyParsed.length === 0) return;

  const printifyIds = new Set(printifyParsed.map((v) => v.id));
  const oldMap = parseListingPrintifyVariantPrices(listing.listingPrintifyVariantPrices);
  if (!oldMap || Object.keys(oldMap).length === 0) return;

  const keys = Object.keys(oldMap);
  if (keys.every((k) => printifyIds.has(k))) return;

  const items = await prisma.adminCatalogItem.findMany({ select: { id: true, variants: true } });
  let matched: { id: string; variants: unknown } | null = null;
  const encoded = listing.baselineCatalogPickEncoded?.trim();
  const fromPick = encoded ? parseBaselinePick(encoded) : null;
  if (fromPick?.mode === "allVariants") {
    matched = items.find((it) => it.id === fromPick.itemId) ?? null;
  }
  if (!matched) {
    for (const item of items) {
      if (computeBaselineStubSlug(listing.shopId, item.id, BASELINE_ALL_VARIANTS_STUB_KEY) === product.slug) {
        matched = item;
        break;
      }
    }
  }
  if (!matched) return;

  const catalogVariants = parseAdminCatalogVariantsJson(matched.variants);
  if (catalogVariants.length === 0) return;

  const newMap = mapCatalogPricesToPrintifyVariantIds(catalogVariants, printifyParsed, oldMap);
  if (Object.keys(newMap).length === 0) return;

  await prisma.shopListing.update({
    where: { id: listing.id },
    data: { listingPrintifyVariantPrices: newMap as Prisma.InputJsonValue },
  });
}
