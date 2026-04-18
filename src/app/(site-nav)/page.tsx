import Link from "next/link";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { ProductCard } from "@/components/ProductCard";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import {
  getFeaturedCreatorShopsForHome,
  getHotListingProductsForHome,
} from "@/lib/marketplace-home";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const accountDeletedRaw = sp.accountDeleted;
  const accountDeleted =
    typeof accountDeletedRaw === "string"
      ? accountDeletedRaw
      : Array.isArray(accountDeletedRaw)
        ? accountDeletedRaw[0]
        : undefined;
  let featuredShops: Awaited<ReturnType<typeof getFeaturedCreatorShopsForHome>>;
  let hotProducts: Awaited<ReturnType<typeof getHotListingProductsForHome>>;
  try {
    [featuredShops, hotProducts] = await Promise.all([
      getFeaturedCreatorShopsForHome(),
      getHotListingProductsForHome(10),
    ]);
  } catch (e) {
    return <ShopDataLoadError cause={e} />;
  }

  const featuredShopCards = featuredShops
    .map((s) => {
      const listing = s.homeFeaturedListing;
      if (!listing?.product?.active) return null;
      return {
        shop: s,
        product: productCardProductFromListing({
          id: listing.id,
          shopId: listing.shopId,
          priceCents: listing.priceCents,
          product: listing.product,
          requestItemName: listing.requestItemName,
          adminListingSecondaryImageUrl: listing.adminListingSecondaryImageUrl,
          ownerSupplementImageUrl: listing.ownerSupplementImageUrl,
          listingStorefrontCatalogImageUrls: listing.listingStorefrontCatalogImageUrls,
        }),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-10 sm:py-14">
      <header className="text-center">
        <h1 className="store-dimension-page-title text-3xl text-zinc-50 sm:text-4xl">
          Creator Shops
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm text-zinc-400">
          Browse independent shops or open a shop — platform catalog and fulfillment stay unified.
        </p>
      </header>

      {accountDeleted === "1" ? (
        <p className="mx-auto mt-8 max-w-lg rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-center text-sm text-emerald-200/90">
          Your shop account was removed. You can create a new shop anytime from{" "}
          <Link href="/create-shop" className="text-emerald-100 underline decoration-emerald-700 underline-offset-2">
            Create shop
          </Link>
          .
        </p>
      ) : null}

      {featuredShopCards.length > 0 ? (
        <section className="mt-16">
          <h2 className="text-center text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Featured Creators
          </h2>
          <ul className="mt-6 flex flex-wrap justify-center gap-6">
            {featuredShopCards.map(({ shop, product }) => (
              <li key={shop.id} className="w-[175px] text-center">
                <Link href={`/s/${shop.slug}`} className="inline-block">
                  {shop.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shop.profileImageUrl}
                      alt=""
                      className="mx-auto h-24 w-24 rounded-full border border-zinc-700 object-cover transition hover:border-blue-700/50"
                    />
                  ) : (
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs text-zinc-500">
                      {shop.displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <p className="mt-2 text-sm font-medium text-zinc-200 hover:text-blue-200/90">
                    {shop.displayName}
                  </p>
                </Link>
                <div className="mt-3 flex justify-center">
                  <ProductCard product={product} shopSlug={shop.slug} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hotProducts.length > 0 ? (
        <section className="mt-16">
          <h2 className="text-center text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Hot items
          </h2>
          <div className="mt-6">
            <FeaturedProductsCarousel
              items={productsToFeaturedCarouselItems(hotProducts)}
              label="Hot right now"
            />
          </div>
        </section>
      ) : null}

      <div className="mt-16 border-t border-zinc-800/80 pt-10 text-center">
        <Link
          href={SHOP_ALL_ROUTE}
          className="text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-blue-400/90 hover:decoration-blue-400/50"
        >
          View all products (platform catalog)
        </Link>
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          href="/shops"
          className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-blue-950/40 to-zinc-950 px-8 py-5 text-center text-sm font-medium text-blue-100 transition hover:border-blue-700/60"
        >
          Browse Creator Shops
        </Link>
      </div>

      <SiteLegalFooter />
    </main>
  );
}
