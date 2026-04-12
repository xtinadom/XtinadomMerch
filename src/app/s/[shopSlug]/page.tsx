import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { shopAllProductsHref, shopDommeHref, shopSubHref } from "@/lib/marketplace-constants";
import { ShopSocialLinksRow } from "@/components/ShopSocialLinksRow";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopSlug: string }> };

export default async function ShopTenantHomePage({ params }: Props) {
  const { shopSlug } = await params;
  const shop = await prisma.shop.findFirst({
    where: { slug: shopSlug, active: true },
    include: {
      homeFeaturedListing: {
        include: {
          product: {
            include: {
              primaryTag: true,
              tags: { include: { tag: true } },
            },
          },
        },
      },
    },
  });
  if (!shop) notFound();

  const featuredList =
    shop.homeFeaturedListing?.product &&
    shop.homeFeaturedListing.active &&
    shop.homeFeaturedListing.product.active
      ? [
          productCardProductFromListing({
            priceCents: shop.homeFeaturedListing.priceCents,
            product: shop.homeFeaturedListing.product,
          }),
        ]
      : [];

  const listings = await prisma.shopListing.findMany({
    where: { shopId: shop.id, active: true, featuredOnShop: true },
    take: 12,
    orderBy: { updatedAt: "desc" },
    include: {
      product: {
        include: { primaryTag: true, tags: { include: { tag: true } } },
      },
    },
  });
  const carouselProducts = listings.map((l) => productCardProductFromListing(l));

  return (
    <div>
      <div className="mb-10 text-center">
        {shop.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.profileImageUrl}
            alt=""
            className="mx-auto h-28 w-28 rounded-full border border-zinc-700 object-cover"
          />
        ) : (
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm text-zinc-500">
            Shop
          </div>
        )}
        <h1 className="store-dimension-page-title mt-4 text-3xl text-zinc-50">
          {shop.displayName}
        </h1>
        {shop.welcomeMessage?.trim() ? (
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-300">
            {shop.welcomeMessage.trim()}
          </p>
        ) : null}
        {shop.bio ? (
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">{shop.bio}</p>
        ) : null}
        <ShopSocialLinksRow raw={shop.socialLinks} />
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <Link
            href={shopAllProductsHref(shopSlug)}
            className="rounded-lg border border-blue-900/50 bg-blue-950/30 px-4 py-2 text-blue-100 hover:bg-blue-950/50"
          >
            All products
          </Link>
          <Link
            href={shopSubHref(shopSlug)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200 hover:bg-zinc-900"
          >
            Sub collection
          </Link>
          <Link
            href={shopDommeHref(shopSlug)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200 hover:bg-zinc-900"
          >
            Domme collection
          </Link>
        </div>
      </div>

      {featuredList.length > 0 ? (
        <section className="mb-12">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Featured
          </h2>
          <FeaturedProductsCarousel
            items={productsToFeaturedCarouselItems(featuredList)}
            label={`Featured at ${shop.displayName}`}
          />
        </section>
      ) : null}

      {carouselProducts.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Highlights
          </h2>
          <FeaturedProductsCarousel
            items={productsToFeaturedCarouselItems(carouselProducts)}
            label="Featured items"
          />
        </section>
      ) : featuredList.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">
          Listings will appear here once this shop is stocked.
        </p>
      ) : null}
    </div>
  );
}
