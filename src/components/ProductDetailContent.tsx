import Link from "next/link";
import { ProductAddToCartForm } from "@/components/ProductAddToCartForm";
import { productImageUrlsForShopListing } from "@/lib/product-media";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { PrintifyVariantAddToCart } from "@/components/PrintifyVariantAddToCart";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import type { StorefrontProduct } from "@/lib/product-storefront";
import { PLATFORM_SHOP_SLUG, shopAllProductsHref, shopUniversalTagHref } from "@/lib/marketplace-constants";

const SHOP_NAME_LINK_CLASS =
  "store-dimension-brand text-sm uppercase tracking-[0.2em] text-blue-400/80 transition hover:text-blue-300/90 sm:text-base";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ProductDetailContent({
  product,
  variant,
  tenant,
  adminListingSecondaryImageUrl,
  ownerSupplementImageUrl,
  listingStorefrontCatalogImageUrls,
  printifyVariantShopPriceCentsById,
  adminCatalogStorefrontDescription,
  /** Shop listing’s item name (`requestItemName`); falls back to `product.name` when missing. */
  listingItemName,
  /** Admin List item `name`; falls back to linked rows on `product` when omitted. */
  adminCatalogItemName,
  /** Shop owner one-line pitch (`ShopListing.storefrontItemBlurb`, max tweet length). */
  storefrontItemBlurb,
}: {
  product: StorefrontProduct;
  variant: "page" | "modal";
  /** When set, cart + breadcrumbs target this shop slug (`/s/...`). */
  tenant?: { shopSlug: string; listingPriceCents: number; shopDisplayName: string };
  /** Per-variant shop unit prices (cents) for multi-variant Printify picker; from listing row. */
  printifyVariantShopPriceCentsById?: Record<string, number>;
  /** Optional admin-set listing image (tenant PDP only). */
  adminListingSecondaryImageUrl?: string | null;
  /** Extra listing image from the shop owner (tenant PDP only). */
  ownerSupplementImageUrl?: string | null;
  /** Catalog image subset for this shop listing; undefined = all catalog images. */
  listingStorefrontCatalogImageUrls?: string[];
  /**
   * Admin List “Storefront description” (resolved server-side). When set, used before
   * `Product.description`. Omit for legacy callers that only pass `product`.
   */
  adminCatalogStorefrontDescription?: string;
  listingItemName?: string | null;
  adminCatalogItemName?: string | null;
  storefrontItemBlurb?: string | null;
}) {
  const shopSlug = tenant?.shopSlug ?? PLATFORM_SHOP_SLUG;
  const displayItemName = listingItemName?.trim() || product.name;
  const catalogNameFromProduct =
    product.adminCatalogItemPlatformLinks?.map((x) => x.name?.trim()).find(Boolean) ?? null;
  const resolvedAdminCatalogItemName =
    adminCatalogItemName?.trim() || catalogNameFromProduct || null;
  const showAdminCatalogSubtitle =
    resolvedAdminCatalogItemName != null &&
    resolvedAdminCatalogItemName.toLowerCase() !== displayItemName.trim().toLowerCase();
  const adminCatalogSubtitle = showAdminCatalogSubtitle ? (
    <p className="mt-1 text-[11px] font-normal leading-snug text-zinc-500 sm:text-xs">
      {resolvedAdminCatalogItemName}
    </p>
  ) : null;
  const displayPriceCents = tenant?.listingPriceCents ?? product.priceCents;

  const images = productImageUrlsForShopListing(product, {
    adminListingSecondaryImageUrl,
    ownerSupplementImageUrl,
    listingStorefrontCatalogImageUrls,
  });
  const printifyVariants = getPrintifyVariantsForProduct(product);
  const multiPrintify = printifyVariants.length > 1;

  const adminFromProductOnly =
    (product.adminCatalogItemPlatformLinks ?? [])
      .map((x) => x.storefrontDescription?.trim() || "")
      .filter(Boolean)
      .join("\n\n") || "";
  const adminPart =
    adminCatalogStorefrontDescription !== undefined
      ? adminCatalogStorefrontDescription
      : adminFromProductOnly;
  const description = adminPart.trim() || product.description?.trim() || "";
  const blurbText = storefrontItemBlurb?.trim() || "";

  const primary = product.primaryTag;
  const allProductsHref =
    shopSlug === PLATFORM_SHOP_SLUG ? SHOP_ALL_ROUTE : shopAllProductsHref(shopSlug);
  const breadcrumb = primary ? (
    <p className="store-kicker mb-8 text-zinc-500">
      <Link
        href={shopUniversalTagHref(shopSlug, primary.slug)}
        className="hover:text-blue-400/90"
      >
        {primary.name}
      </Link>
    </p>
  ) : null;

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
          <ProductAddToCartForm
            productId={product.id}
            shopSlug={shopSlug === PLATFORM_SHOP_SLUG ? undefined : shopSlug}
          />
        </div>
      )}
      <div>
        {tenant ? (
          <p className="m-0">
            <Link
              href={
                shopSlug === PLATFORM_SHOP_SLUG
                  ? allProductsHref
                  : `/s/${encodeURIComponent(shopSlug)}`
              }
              className={SHOP_NAME_LINK_CLASS}
            >
              {tenant.shopDisplayName}
            </Link>
          </p>
        ) : null}
        {variant === "page" ? (
          <h1
            className={
              tenant
                ? "mt-1.5 text-sm font-medium leading-snug text-zinc-100 sm:mt-2 sm:text-base"
                : "m-0 text-sm font-medium leading-snug text-zinc-100 sm:text-base"
            }
          >
            {displayItemName}
          </h1>
        ) : null}
        {variant === "page" ? adminCatalogSubtitle : null}
        {!multiPrintify ? (
          <p
            className={
              variant === "page" || tenant
                ? "mt-3 text-2xl text-blue-200/90"
                : "text-2xl text-blue-200/90"
            }
          >
            {formatPrice(displayPriceCents)}
          </p>
        ) : null}
        {blurbText ? (
          <p className="mt-6 whitespace-pre-line text-sm italic leading-relaxed text-zinc-300">
            {blurbText}
          </p>
        ) : null}
        {description ? (
          <div className={blurbText ? "mt-5" : "mt-6"}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Item details</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-400">{description}</p>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (variant === "page") {
    return (
      <StoreDocumentPanel backHref={allProductsHref} backLabel="All products" omitHeaderTitle>
        {breadcrumb ? <div className="-mt-2">{breadcrumb}</div> : null}
        {grid}
      </StoreDocumentPanel>
    );
  }

  return (
    <>
      {breadcrumb}
      <div className="mb-8">
        <h2
          id="product-modal-title"
          className="store-dimension-page-title text-2xl text-zinc-50 sm:text-3xl"
        >
          {displayItemName}
        </h2>
        {adminCatalogSubtitle}
      </div>
      {grid}
    </>
  );
}
