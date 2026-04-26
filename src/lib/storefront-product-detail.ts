import { printifyVariantShopPriceCentsByIdForListing } from "@/lib/listing-cart-price";
import { parseListingStorefrontCatalogImageSelection } from "@/lib/product-media";
import { prisma } from "@/lib/prisma";
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
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";

function mergeAdminCatalogDescriptions(
  rows: Iterable<{ storefrontDescription: string | null }>,
): string {
  const parts: string[] = [];
  for (const row of rows) {
    const t = row.storefrontDescription?.trim();
    if (t) parts.push(t);
  }
  return parts.join("\n\n");
}

/**
 * Admin List “Storefront description” for this product: linked `AdminCatalogItem` rows, else baseline
 * pick on the listing (when the platform product link was never set), else a direct query by
 * `itemPlatformProductId`.
 */
export async function resolveAdminCatalogStorefrontText(
  product: StorefrontProduct,
  listing: StorefrontShopListing | null,
): Promise<string> {
  const fromLinks = mergeAdminCatalogDescriptions(product.adminCatalogItemPlatformLinks ?? []);
  if (fromLinks) return fromLinks;

  if (listing?.baselineCatalogPickEncoded) {
    const pick = parseBaselinePick(listing.baselineCatalogPickEncoded);
    if (pick) {
      const item = await prisma.adminCatalogItem.findUnique({
        where: { id: pick.itemId },
        select: { storefrontDescription: true },
      });
      const t = item?.storefrontDescription?.trim();
      if (t) return t;
    }
  }

  const direct = await prisma.adminCatalogItem.findMany({
    where: { itemPlatformProductId: product.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { storefrontDescription: true },
  });
  return mergeAdminCatalogDescriptions(direct);
}

/** Admin List item `name` for this product: linked rows, else baseline pick, else `itemPlatformProductId`. */
export async function resolveAdminCatalogItemName(
  product: StorefrontProduct,
  listing: StorefrontShopListing | null,
): Promise<string | null> {
  for (const x of product.adminCatalogItemPlatformLinks ?? []) {
    const n = x.name?.trim();
    if (n) return n;
  }
  if (listing?.baselineCatalogPickEncoded) {
    const pick = parseBaselinePick(listing.baselineCatalogPickEncoded);
    if (pick) {
      const item = await prisma.adminCatalogItem.findUnique({
        where: { id: pick.itemId },
        select: { name: true },
      });
      const n = item?.name?.trim();
      if (n) return n;
    }
  }
  const direct = await prisma.adminCatalogItem.findFirst({
    where: { itemPlatformProductId: product.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { name: true },
  });
  return direct?.name?.trim() || null;
}

/** Props bundle for {@link ProductDetailContent} from a listing row or bare product. */
export type ResolvedPublicProductDetail = {
  product: StorefrontProduct;
  tenant?: { shopSlug: string; listingPriceCents: number; shopDisplayName: string };
  /** Per Printify variant shop unit price (cents) for multi-variant picker; aligns with cart line pricing. */
  printifyVariantShopPriceCentsById?: Record<string, number>;
  adminListingSecondaryImageUrl?: string | null;
  ownerSupplementImageUrl?: string | null;
  listingStorefrontCatalogImageUrls?: string[];
  /**
   * Resolved Admin List storefront body (may be empty). PDP uses this before `Product.description`
   * (Printify / legacy catalog text).
   */
  adminCatalogStorefrontDescription?: string;
  /** `ShopListing.requestItemName` when the PDP is tied to a listing; preferred over `Product.name` for the title. */
  listingItemName?: string | null;
  /** Admin List catalog item `name` (resolved server-side). */
  adminCatalogItemName?: string | null;
  /** Shop owner one-line pitch (`ShopListing.storefrontItemBlurb`). */
  storefrontItemBlurb?: string | null;
};

async function withAdminCatalogStorefrontDescription(
  detail: ResolvedPublicProductDetail,
  listing: StorefrontShopListing | null,
): Promise<ResolvedPublicProductDetail> {
  const [adminCatalogStorefrontDescription, adminCatalogItemName] = await Promise.all([
    resolveAdminCatalogStorefrontText(detail.product, listing),
    resolveAdminCatalogItemName(detail.product, listing),
  ]);
  return { ...detail, adminCatalogStorefrontDescription, adminCatalogItemName };
}

export function mapListingRowToProductDetail(row: StorefrontShopListing): ResolvedPublicProductDetail {
  const catalogSel = parseListingStorefrontCatalogImageSelection(row.listingStorefrontCatalogImageUrls);
  return {
    product: row.product,
    tenant: {
      shopSlug: row.shop.slug,
      listingPriceCents: row.priceCents,
      shopDisplayName: row.shop.displayName,
    },
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
    listingItemName: row.requestItemName?.trim() || null,
    storefrontItemBlurb: row.storefrontItemBlurb?.trim() || null,
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
    if (row) return withAdminCatalogStorefrontDescription(mapListingRowToProductDetail(row), row);
  } else {
    const uniqueRow = await loadStorefrontListingForProductWhenExactlyOne(productSlug);
    if (uniqueRow) {
      return withAdminCatalogStorefrontDescription(mapListingRowToProductDetail(uniqueRow), uniqueRow);
    }

    const platformRow = await loadStorefrontListingByShopAndProductSlug(
      PLATFORM_SHOP_SLUG,
      productSlug,
    );
    if (platformRow) {
      return withAdminCatalogStorefrontDescription(mapListingRowToProductDetail(platformRow), platformRow);
    }
  }
  const product = await loadStorefrontProductBySlug(productSlug);
  if (!product) return null;
  return withAdminCatalogStorefrontDescription({ product }, null);
}
