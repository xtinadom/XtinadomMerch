import { prisma } from "@/lib/prisma";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";

const include = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

export type StorefrontProduct = NonNullable<
  Awaited<ReturnType<typeof loadStorefrontProductBySlug>>
>;

export async function loadStorefrontProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug, active: true },
    include,
  });
}

/** Active listing for a product in a given shop (used on `/s/[shopSlug]/product/...`). */
export async function loadStorefrontListingByShopAndProductSlug(
  shopSlug: string,
  productSlug: string,
) {
  return prisma.shopListing.findFirst({
    where: {
      ...storefrontShopListingWhere,
      shop: { slug: shopSlug, active: true },
      product: { slug: productSlug, active: true },
    },
    include: {
      product: { include },
      shop: { select: { id: true, slug: true, displayName: true } },
    },
  });
}

export type StorefrontShopListing = NonNullable<
  Awaited<ReturnType<typeof loadStorefrontListingByShopAndProductSlug>>
>;
