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

/**
 * When `/product/[slug]` has no `?shop=`, we can still attach listing-driven media (admin image,
 * catalog selection) if exactly one storefront-visible listing exists for this product. If more
 * than one shop lists it, callers must use `?shop=` or `/s/[shopSlug]/product/...`.
 */
export async function loadStorefrontListingForProductWhenExactlyOne(productSlug: string) {
  const rows = await prisma.shopListing.findMany({
    where: {
      ...storefrontShopListingWhere,
      shop: { active: true },
      product: { slug: productSlug, active: true },
    },
    take: 2,
    orderBy: { updatedAt: "desc" },
    include: {
      product: { include },
      shop: { select: { id: true, slug: true, displayName: true } },
    },
  });
  return rows.length === 1 ? rows[0]! : null;
}
