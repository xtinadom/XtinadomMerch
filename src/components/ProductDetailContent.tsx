import Link from "next/link";
import { FulfillmentType, Audience } from "@/generated/prisma/enums";
import { ProductAddToCartForm } from "@/components/ProductAddToCartForm";
import { getShippingFlatCents } from "@/lib/shipping";
import { productImageUrls } from "@/lib/product-media";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { PrintifyVariantAddToCart } from "@/components/PrintifyVariantAddToCart";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";
import {
  SHOP_ALL_ROUTE,
  SHOP_DOMME_ROUTE,
  SHOP_SUB_ROUTE,
} from "@/lib/constants";
import type { StorefrontProduct } from "@/lib/product-storefront";

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

function shopHomeForAudience(audience: Audience): string {
  if (audience === Audience.both) return SHOP_ALL_ROUTE;
  if (audience === Audience.domme) return SHOP_DOMME_ROUTE;
  return SHOP_SUB_ROUTE;
}

function backLabelForAudience(audience: Audience): string {
  if (audience === Audience.both) return "All products";
  if (audience === Audience.domme) return "Domme collection";
  return "Sub collection";
}

export function ProductDetailContent({
  product,
  variant,
}: {
  product: StorefrontProduct;
  variant: "page" | "modal";
}) {
  const availability = stockLabel(
    product.fulfillmentType,
    product.trackInventory,
    product.stockQuantity,
  );
  const shippingCents = getShippingFlatCents();
  const images = productImageUrls(product);
  const printifyVariants = getPrintifyVariantsForProduct(product);
  const multiPrintify =
    product.fulfillmentType === FulfillmentType.printify &&
    printifyVariants.length > 1;

  const shopHref = shopHomeForAudience(product.audience);
  const primary = product.primaryTag;
  const tagHref =
    primary != null ? `/shop/tag/${primary.slug}` : shopHref;

  const breadcrumb = (
    <p className="store-kicker mb-8 text-zinc-500">
      <Link href={SHOP_ALL_ROUTE} className="hover:text-blue-400/90">
        All products
      </Link>
      {product.audience !== Audience.both ? (
        <>
          <span className="mx-2 text-zinc-700">·</span>
          <Link href={shopHref} className="hover:text-blue-400/90">
            {product.audience === Audience.domme
              ? "Domme collection"
              : "Sub collection"}
          </Link>
        </>
      ) : null}
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
          variants={printifyVariants.map((v) => ({
            id: v.id,
            title: v.title,
            priceCents: v.priceCents,
            imageUrl: v.imageUrl ?? null,
          }))}
          galleryExtras={images}
        />
      ) : (
        <div className="mx-auto w-full max-w-[400px]">
          <ProductImageGallery images={images} />
          {availability !== "Sold out" && (
            <ProductAddToCartForm productId={product.id} />
          )}
        </div>
      )}
      <div>
        {!multiPrintify ? (
          <p className="text-2xl text-blue-200/90">
            {formatPrice(product.priceCents)}
          </p>
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
        backHref={shopHref}
        backLabel={backLabelForAudience(product.audience)}
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
