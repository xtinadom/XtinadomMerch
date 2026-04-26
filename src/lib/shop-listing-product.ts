import type { ProductCardProduct } from "@/components/ProductCard";
import { parseListingPrintifyVariantPrices } from "@/lib/listing-printify-variant-prices";
import { parseListingStorefrontCatalogImageSelection } from "@/lib/product-media";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import {
  sanitizeShopListingAdminSecondaryImageUrlForDisplay,
  sanitizeShopListingOwnerSupplementImageUrlForDisplay,
} from "@/lib/r2-upload";

function listingCardPriceCents(listing: {
  priceCents: number;
  listingPrintifyVariantId?: string | null;
  listingPrintifyVariantPrices?: unknown;
  product: ProductCardProduct;
}): number {
  const p = listing.product;
  const variants = getPrintifyVariantsForProduct(p);
  if (variants.length <= 1) return listing.priceCents;
  const map = parseListingPrintifyVariantPrices(listing.listingPrintifyVariantPrices);
  let min = Infinity;
  for (const v of variants) {
    const c = map?.[v.id] ?? listing.priceCents;
    min = Math.min(min, c);
  }
  return Number.isFinite(min) ? min : listing.priceCents;
}

export function productCardProductFromListing<
  LP extends {
    id: string;
    shopId: string;
    priceCents: number;
    listingPrintifyVariantId?: string | null;
    listingPrintifyVariantPrices?: unknown;
    product: ProductCardProduct;
    requestItemName?: string | null;
    adminListingSecondaryImageUrl?: string | null;
    ownerSupplementImageUrl?: string | null;
    listingStorefrontCatalogImageUrls?: unknown;
    shop?: { slug: string; displayName?: string } | null;
  },
>(listing: LP): ProductCardProduct {
  const custom = listing.requestItemName?.trim();
  const name = custom || listing.product.name;
  const catalogSel = parseListingStorefrontCatalogImageSelection(
    listing.listingStorefrontCatalogImageUrls,
  );
  const storefrontShopSlug = listing.shop?.slug?.trim() || undefined;
  const storefrontShopDisplayName = listing.shop?.displayName?.trim() || undefined;
  return {
    ...listing.product,
    name,
    priceCents: listingCardPriceCents(listing),
    ...(storefrontShopSlug ? { storefrontShopSlug } : {}),
    ...(storefrontShopDisplayName ? { storefrontShopDisplayName } : {}),
    adminListingSecondaryImageUrl: sanitizeShopListingAdminSecondaryImageUrlForDisplay(
      listing.adminListingSecondaryImageUrl,
      listing.shopId,
      listing.id,
    ),
    ownerSupplementImageUrl: sanitizeShopListingOwnerSupplementImageUrlForDisplay(
      listing.ownerSupplementImageUrl,
      listing.shopId,
      listing.id,
    ),
    ...(catalogSel !== null ? { listingStorefrontCatalogImageUrls: catalogSel } : {}),
  };
}
