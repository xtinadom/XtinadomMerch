import type { Prisma } from "@/generated/prisma/client";
import { productPrimaryImageForShopListing } from "@/lib/product-media";

export type FeaturedCarouselItem = {
  slug: string;
  name: string;
  imageUrl: string;
};

type ProductForFeatured = {
  slug: string;
  name: string;
  updatedAt: Date;
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
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
    }));
}
