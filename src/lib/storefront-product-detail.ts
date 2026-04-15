import { printifyVariantShopPriceCentsByIdForListing } from "@/lib/listing-cart-price";
import { parseListingStorefrontCatalogImageSelection } from "@/lib/product-media";
import {
  sanitizeShopListingAdminSecondaryImageUrlForDisplay,
  sanitizeShopListingOwnerSupplementImageUrlForDisplay,
} from "@/lib/r2-upload";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  loadStorefrontListingByShopAndProductSlug,
  loadStorefrontListingForProductWhenExactlyOne,
  loadStorefrontProductBySlug,
  type StorefrontProduct,
  type StorefrontShopListing,
} from "@/lib/product-storefront";

/** Props bundle for {@link ProductDetailContent} from a listing row or bare product. */
export type ResolvedPublicProductDetail = {
  product: StorefrontProduct;
  tenant?: { shopSlug: string; listingPriceCents: number };
  /** Per Printify variant shop unit price (cents) for multi-variant picker; aligns with cart line pricing. */
  printifyVariantShopPriceCentsById?: Record<string, number>;
  adminListingSecondaryImageUrl?: string | null;
  ownerSupplementImageUrl?: string | null;
  listingStorefrontCatalogImageUrls?: string[];
};

export function mapListingRowToProductDetail(row: StorefrontShopListing): ResolvedPublicProductDetail {
  const catalogSel = parseListingStorefrontCatalogImageSelection(row.listingStorefrontCatalogImageUrls);
  return {
    product: row.product,
    tenant: { shopSlug: row.shop.slug, listingPriceCents: row.priceCents },
    printifyVariantShopPriceCentsById: printifyVariantShopPriceCentsByIdForListing(row, row.product),
    adminListingSecondaryImageUrl: sanitizeShopListingAdminSecondaryImageUrlForDisplay(
      row.adminListingSecondaryImageUrl,
      row.shopId,
      row.id,
    ),
    ownerSupplementImageUrl: sanitizeShopListingOwnerSupplementImageUrlForDisplay(
      row.ownerSupplementImageUrl,
      row.shopId,
      row.id,
    ),
    listingStorefrontCatalogImageUrls: catalogSel === null ? undefined : catalogSel,
  };
}

/**
 * For `/product/[slug]` and the intercepting modal: optional `?shop=` loads that shop’s live listing
 * (catalog selection, admin/owner images). Without `shop`, tries a single storefront-visible listing
 * for the product (any shop) first, then the platform shop listing, so creator-only listings are not
 * shadowed by the platform row. Otherwise falls back to the catalog product only.
 */
export async function resolvePublicProductDetail(
  productSlug: string,
  shopSlug?: string | null,
): Promise<ResolvedPublicProductDetail | null> {
  const shop = typeof shopSlug === "string" ? shopSlug.trim() : "";
  if (shop) {
    const row = await loadStorefrontListingByShopAndProductSlug(shop, productSlug);
    if (row) return mapListingRowToProductDetail(row);
  } else {
    const uniqueRow = await loadStorefrontListingForProductWhenExactlyOne(productSlug);
    if (uniqueRow) return mapListingRowToProductDetail(uniqueRow);

    const platformRow = await loadStorefrontListingByShopAndProductSlug(
      PLATFORM_SHOP_SLUG,
      productSlug,
    );
    if (platformRow) return mapListingRowToProductDetail(platformRow);
  }
  const product = await loadStorefrontProductBySlug(productSlug);
  if (!product) return null;
  return { product };
}
