import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreTags } from "@/lib/store-tags";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { ProductCard } from "@/components/ProductCard";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const productInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

export default async function ShopUniversalTagPage({ params }: Props) {
  const { slug } = await params;
  const tags = await getStoreTags();
  let activeTag = tags.find((t) => t.slug === slug) ?? null;
  if (!activeTag) {
    try {
      const t = await prisma.tag.findUnique({ where: { slug } });
      if (!t) notFound();
      activeTag = t;
    } catch (e) {
      console.error("[ShopUniversalTagPage] resolve tag", e);
      return <ShopDataLoadError cause={e} />;
    }
  }

  const shop = await prisma.shop.findUnique({ where: { slug: PLATFORM_SHOP_SLUG } });
  if (!shop) notFound();

  let listings;
  try {
    listings = await prisma.shopListing.findMany({
      where: {
        shopId: shop.id,
        ...storefrontShopListingWhere,
        product: {
          active: true,
          tags: { some: { tagId: activeTag.id } },
        },
      },
      orderBy: { product: { name: "asc" } },
      include: { product: { include: productInclude } },
    });
  } catch (e) {
    console.error("[ShopUniversalTagPage] listings", e);
    return <ShopDataLoadError cause={e} />;
  }

  const products = listings.map((l) => productCardProductFromListing(l));

  return (
    <div>
      <p className="text-xs text-zinc-500">
        <Link href={SHOP_ALL_ROUTE} className="hover:text-blue-400/90">
          All products
        </Link>
        <span className="mx-1.5 text-zinc-600">/</span>
        <span className="text-zinc-400">{activeTag.name}</span>
      </p>
      <h1 className="store-dimension-page-title mt-2 text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
        {activeTag.name}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">All items in this shop with this tag.</p>

      <FeaturedProductsCarousel
        items={productsToFeaturedCarouselItems(products)}
        label={`Featured with tag ${activeTag.name}`}
      />

      {products.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600">No products with this tag yet.</p>
      ) : (
        <ul className="mt-8 grid justify-center gap-3 [grid-template-columns:repeat(auto-fill,175px)] sm:justify-start">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
