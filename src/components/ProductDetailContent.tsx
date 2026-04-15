import Link from "next/link";
import { FulfillmentType } from "@/generated/prisma/enums";
import { ProductAddToCartForm } from "@/components/ProductAddToCartForm";
import { getShippingFlatCents } from "@/lib/shipping";
import { productImageUrlsForShopListing } from "@/lib/product-media";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { PrintifyVariantAddToCart } from "@/components/PrintifyVariantAddToCart";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import type { StorefrontProduct } from "@/lib/product-storefront";
import { PLATFORM_SHOP_SLUG, shopAllProductsHref, shopUniversalTagHref } from "@/lib/marketplace-constants";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function stockLabel(
  fulfillment: string,
  track: boolean,
  qty: number,
): string {
  if (fulfillment === FulfillmentType.printify) return "In stock";
  if (fulfillment !== FulfillmentType.manual || !track) return "Available";
  if (qty <= 0) return "Sold out";
  return "In stock";
}

export function ProductDetailContent({
  product,
  variant,
  tenant,
  adminListingSecondaryImageUrl,
  ownerSupplementImageUrl,
  listingStorefrontCatalogImageUrls,
  printifyVariantShopPriceCentsById,
}: {
  product: StorefrontProduct;
  variant: "page" | "modal";
  /** When set, cart + breadcrumbs target this shop slug (`/s/...`). */
  tenant?: { shopSlug: string; listingPriceCents: number };
  /** Per-variant shop unit prices (cents) for multi-variant Printify picker; from listing row. */
  printifyVariantShopPriceCentsById?: Record<string, number>;
  /** Optional admin-set listing image (tenant PDP only). */
  adminListingSecondaryImageUrl?: string | null;
  /** Extra listing image from the shop owner (tenant PDP only). */
  ownerSupplementImageUrl?: string | null;
  /** Catalog image subset for this shop listing; undefined = all catalog images. */
  listingStorefrontCatalogImageUrls?: string[];
}) {
  const shopSlug = tenant?.shopSlug ?? PLATFORM_SHOP_SLUG;
  const displayPriceCents = tenant?.listingPriceCents ?? product.priceCents;

  const availability = stockLabel(
    product.fulfillmentType,
    product.trackInventory,
    product.stockQuantity,
  );
  const shippingCents = getShippingFlatCents();
  const images = productImageUrlsForShopListing(product, {
    adminListingSecondaryImageUrl,
    ownerSupplementImageUrl,
    listingStorefrontCatalogImageUrls,
  });
  const printifyVariants = getPrintifyVariantsForProduct(product);
  const multiPrintify =
    product.fulfillmentType === FulfillmentType.printify &&
    printifyVariants.length > 1;

  const primary = product.primaryTag;
  const allProductsHref =
    shopSlug === PLATFORM_SHOP_SLUG ? SHOP_ALL_ROUTE : shopAllProductsHref(shopSlug);
  const tagHref =
    primary != null ? shopUniversalTagHref(shopSlug, primary.slug) : allProductsHref;

  const breadcrumb = (
    <p className="store-kicker mb-8 text-zinc-500">
      <Link href={allProductsHref} className="hover:text-blue-400/90">
        All products
      </Link>
      {primary ? (
        <>
          <span className="mx-2 text-zinc-700">·</span>
          <Link href={tagHref} className="hover:text-blue-400/90">
            {primary.name}
          </Link>
        </>
      ) : null}
    </p>
  );

  const grid = (
    <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
      {multiPrintify ? (
        <PrintifyVariantAddToCart
          productId={product.id}
          shopSlug={shopSlug === PLATFORM_SHOP_SLUG ? undefined : shopSlug}
          variants={printifyVariants.map((v) => ({
            id: v.id,
            title: v.title,
            priceCents:
              printifyVariantShopPriceCentsById?.[v.id] ??
              (tenant != null ? tenant.listingPriceCents : v.priceCents),
            imageUrl: v.imageUrl ?? null,
          }))}
          galleryExtras={images}
        />
      ) : (
        <div className="mx-auto w-full max-w-[400px]">
          <ProductImageGallery images={images} />
          {availability !== "Sold out" && (
            <ProductAddToCartForm
              productId={product.id}
              shopSlug={shopSlug === PLATFORM_SHOP_SLUG ? undefined : shopSlug}
            />
          )}
        </div>
      )}
      <div>
        {!multiPrintify ? (
          <p className="text-2xl text-blue-200/90">{formatPrice(displayPriceCents)}</p>
        ) : null}
        <p
          className={`mt-2 text-sm ${
            availability === "Sold out" ? "text-amber-400" : "text-zinc-500"
          }`}
        >
          {availability}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Shipping: {formatPrice(shippingCents)} flat rate
        </p>
        {product.description && (
          <p className="mt-6 text-sm leading-relaxed text-zinc-400">
            {product.description}
          </p>
        )}
        <p className="mt-6 text-xs text-zinc-600">
          {product.fulfillmentType === FulfillmentType.printify
            ? "Print on demand — ships from our print partner."
            : "Shipped directly by Xtinadom."}
        </p>
      </div>
    </div>
  );

  if (variant === "page") {
    return (
      <StoreDocumentPanel
        backHref={allProductsHref}
        backLabel="All products"
        title={product.name}
      >
        <div className="-mt-2">{breadcrumb}</div>
        {grid}
      </StoreDocumentPanel>
    );
  }

  return (
    <>
      {breadcrumb}
      <h2
        id="product-modal-title"
        className="store-dimension-page-title mb-8 text-2xl text-zinc-50 sm:text-3xl"
      >
        {product.name}
      </h2>
      {grid}
    </>
  );
}
