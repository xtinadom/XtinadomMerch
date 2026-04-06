import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FulfillmentType, Audience } from "@/generated/prisma/enums";
import { addToCart } from "@/actions/cart";
import { getShippingFlatCents } from "@/lib/shipping";
import { productImageUrls } from "@/lib/product-media";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";
import { PrintifyVariantAddToCart } from "@/components/PrintifyVariantAddToCart";
import { SHOP_DOMME_ROUTE, SHOP_SUB_ROUTE } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

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
  if (fulfillment !== FulfillmentType.manual || !track) return "Available";
  if (qty <= 0) return "Sold out";
  return "In stock";
}

function shopHomeForAudience(audience: Audience): string {
  if (audience === Audience.domme) return SHOP_DOMME_ROUTE;
  if (audience === Audience.sub) return SHOP_SUB_ROUTE;
  return SHOP_SUB_ROUTE;
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug, active: true },
    include: {
      primaryTag: true,
      tags: { include: { tag: true } },
    },
  });

  if (!product) notFound();

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
    primary != null
      ? product.audience === Audience.domme
        ? `${SHOP_DOMME_ROUTE}/tag/${primary.slug}`
        : `${SHOP_SUB_ROUTE}/tag/${primary.slug}`
      : shopHref;

  return (
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
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-zinc-900">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[0]}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center text-zinc-600">
                No image
              </div>
            )}
          </div>
          {images.length > 1 ? (
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {images.slice(1).map((src) => (
                <li key={src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-zinc-800 object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {availability !== "Sold out" && (
            <form
              action={async () => {
                "use server";
                await addToCart(product.id, 1);
              }}
              className="mt-4 w-full"
            >
              <button
                type="submit"
                className="w-full rounded-xl bg-rose-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-rose-600"
              >
                Add to cart
              </button>
            </form>
          )}
        </div>
      )}
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          <Link href={shopHref} className="hover:text-rose-400/90">
            {product.audience === Audience.domme
              ? "Domme shop"
              : product.audience === Audience.sub
                ? "Sub shop"
                : "Shop"}
          </Link>
          {primary ? (
            <>
              <span className="mx-1.5 text-zinc-600">/</span>
              <Link href={tagHref} className="hover:text-rose-400/90">
                {primary.name}
              </Link>
            </>
          ) : null}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-50">
          {product.name}
        </h1>
        {!multiPrintify ? (
          <p className="mt-4 text-2xl text-rose-200/90">
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
}
