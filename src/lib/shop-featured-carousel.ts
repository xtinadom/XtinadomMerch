import type { Prisma } from "@/generated/prisma/client";
import { productPrimaryImageForShopListing } from "@/lib/product-media";

/** Placeholder tile when a shop has no profile image (carousel expects an image URL). */
export const SHOP_FEATURE_CAROUSEL_PLACEHOLDER_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#18181b"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#71717a" font-family="system-ui,sans-serif" font-size="14">Shop</text></svg>`,
  );

export type FeaturedCarouselItem = {
  slug: string;
  name: string;
  imageUrl: string;
  /** When set, links resolve to `/s/{slug}/product/...` (marketplace aggregate / hot picks). */
  listingShopSlug?: string;
  /** When set, the carousel links here instead of building a product URL (e.g. `/s/{slug}` for shops). */
  href?: string;
};

type ProductForFeatured = {
  slug: string;
  name: string;
  updatedAt: Date;
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
  printifyVariants?: Prisma.JsonValue | null;
  storefrontShopSlug?: string;
  adminListingSecondaryImageUrl?: string | null;
  ownerSupplementImageUrl?: string | null;
  listingStorefrontCatalogImageUrls?: string[];
};

const DEFAULT_LIMIT = 12;

/** Newest products with a hero image — used for shop featured carousels. */
export function productsToFeaturedCarouselItems(
  products: ProductForFeatured[],
  options?: { limit?: number },
): FeaturedCarouselItem[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  return [...products]
    .filter((p) =>
      productPrimaryImageForShopListing(p, {
        adminListingSecondaryImageUrl: p.adminListingSecondaryImageUrl,
        ownerSupplementImageUrl: p.ownerSupplementImageUrl,
        listingStorefrontCatalogImageUrls: p.listingStorefrontCatalogImageUrls,
      }),
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      imageUrl: productPrimaryImageForShopListing(p, {
        adminListingSecondaryImageUrl: p.adminListingSecondaryImageUrl,
        ownerSupplementImageUrl: p.ownerSupplementImageUrl,
        listingStorefrontCatalogImageUrls: p.listingStorefrontCatalogImageUrls,
      })!,
      ...(p.storefrontShopSlug ? { listingShopSlug: p.storefrontShopSlug } : {}),
    }));
}

type ShopForFeaturedCarousel = {
  slug: string;
  displayName: string;
  profileImageUrl: string | null;
};

/** Creator shops for `/shops` featured strip — always enough image URLs for the carousel. */
export function shopsToFeaturedCarouselItems(
  shops: ShopForFeaturedCarousel[],
  options?: { limit?: number },
): FeaturedCarouselItem[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  return shops.slice(0, limit).map((s) => ({
    slug: s.slug,
    name: s.displayName,
    imageUrl: s.profileImageUrl?.trim() || SHOP_FEATURE_CAROUSEL_PLACEHOLDER_IMAGE,
    href: `/s/${encodeURIComponent(s.slug)}`,
  }));
}
