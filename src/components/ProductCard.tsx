import Link from "next/link";
import type { Product, Tag } from "@/generated/prisma/client";
import { productPrimaryImageForShopListing } from "@/lib/product-media";
import { cardLabelTag } from "@/lib/product-tags";
import { PLATFORM_SHOP_SLUG, productHref } from "@/lib/marketplace-constants";

export type ProductCardProduct = Product & {
  primaryTag: Tag | null;
  tags: { tagId: string; tag: Tag }[];
  /** When set (e.g. marketplace aggregate), links use this shop instead of the `shopSlug` prop. */
  storefrontShopSlug?: string;
  /** Creator shop display name (marketplace / multi-vendor). */
  storefrontShopDisplayName?: string;
  /** Admin-set optional second listing image (platform R2); owners cannot remove via dashboard. */
  adminListingSecondaryImageUrl?: string | null;
  ownerSupplementImageUrl?: string | null;
  /** Subset of catalog/Printify image URLs for this listing; undefined = show all. */
  listingStorefrontCatalogImageUrls?: string[];
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ProductCard({
  product,
  shopSlug = PLATFORM_SHOP_SLUG,
  showShopName = false,
}: {
  product: ProductCardProduct;
  shopSlug?: string;
  /** When true, show {@link ProductCardProduct.storefrontShopDisplayName} (e.g. platform All products). */
  showShopName?: boolean;
}) {
  const img = productPrimaryImageForShopListing(product, {
    adminListingSecondaryImageUrl: product.adminListingSecondaryImageUrl,
    ownerSupplementImageUrl: product.ownerSupplementImageUrl,
    listingStorefrontCatalogImageUrls: product.listingStorefrontCatalogImageUrls,
  });
  const label = cardLabelTag({
    primaryTagId: product.primaryTagId,
    primaryTag: product.primaryTag,
    tags: product.tags,
  });
  const linkShopSlug = product.storefrontShopSlug ?? shopSlug;
  return (
    <Link
      href={productHref(linkShopSlug, product.slug)}
      scroll={false}
      className="group block w-full max-w-[175px] rounded-md border border-zinc-800 bg-zinc-900/50 p-1.5 transition hover:border-zinc-600 hover:bg-zinc-900"
    >
      <div className="mb-1.5 aspect-square w-full overflow-hidden rounded bg-zinc-800">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full min-h-[72px] items-center justify-center text-[9px] text-zinc-600">
            No image
          </div>
        )}
      </div>
      <div className="mt-0.5 flex items-start justify-between gap-1.5">
        <h2 className="min-w-0 flex-1 truncate text-left text-[11px] font-medium leading-tight text-zinc-100">
          {product.name}
        </h2>
        <div className="max-w-[48%] shrink-0 text-right">
          <p className="line-clamp-2 text-[7px] uppercase leading-tight tracking-wide text-zinc-500 sm:text-[8px]">
            {label?.name ?? "Product"}
          </p>
        </div>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-1.5">
        <p className="min-w-0 text-left text-[10px] text-blue-300/90">
          {formatPrice(product.priceCents)}
        </p>
        {showShopName && product.storefrontShopDisplayName?.trim() ? (
          <p className="line-clamp-1 shrink-0 text-right text-[8px] font-medium text-zinc-400">
            {product.storefrontShopDisplayName.trim()}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
