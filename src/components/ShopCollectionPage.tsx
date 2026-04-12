import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreTags, getStoreTagsForShop } from "@/lib/store-tags";
import { CatalogGroup } from "@/generated/prisma/enums";
import { audienceWhereForCollection } from "@/lib/shop-queries";
import {
  buildByDesignOnePerName,
  buildByItemOnePerTag,
} from "@/lib/shop-by-item-and-design";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { ProductCard } from "@/components/ProductCard";
import { ShopByItemAndDesignBrowse } from "@/components/ShopByItemAndDesignBrowse";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { DommeMerchWebsitePromo } from "@/components/DommeMerchWebsitePromo";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import {
  PLATFORM_SHOP_SLUG,
  shopAllProductsHref,
  shopCollectionTagHref,
  shopUniversalTagHref,
} from "@/lib/marketplace-constants";
import {
  SHOP_ALL_ROUTE,
  SHOP_DOMME_ROUTE,
  SHOP_SUB_ROUTE,
} from "@/lib/constants";

function collectionBaseRoute(collection: CatalogGroup, shopSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) {
    return collection === CatalogGroup.sub ? SHOP_SUB_ROUTE : SHOP_DOMME_ROUTE;
  }
  return collection === CatalogGroup.sub ? `/s/${shopSlug}/sub` : `/s/${shopSlug}/domme`;
}

const productInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

export async function ShopCollectionPage({
  collection,
  tagSlug,
  shopSlug = PLATFORM_SHOP_SLUG,
}: {
  collection: CatalogGroup;
  tagSlug?: string;
  shopSlug?: string;
}) {
  const base = collectionBaseRoute(collection, shopSlug);
  const shop = await prisma.shop.findFirst({
    where: { slug: shopSlug, active: true },
  });
  if (!shop) notFound();

  const tags =
    shopSlug === PLATFORM_SHOP_SLUG
      ? await getStoreTags()
      : await getStoreTagsForShop(shop.id);

  let activeTag: (typeof tags)[0] | null = null;
  if (tagSlug) {
    activeTag = tags.find((t) => t.slug === tagSlug) ?? null;
    if (!activeTag) {
      try {
        const t = await prisma.tag.findUnique({ where: { slug: tagSlug } });
        if (!t) notFound();
        activeTag = t;
      } catch (e) {
        console.error("[ShopCollectionPage] resolve tag", e);
        return <ShopDataLoadError cause={e} />;
      }
    }
  }

  const audience = audienceWhereForCollection(collection);

  if (activeTag) {
    let listings;
    try {
      listings = await prisma.shopListing.findMany({
        where: {
          shopId: shop.id,
          active: true,
          product: {
            active: true,
            audience,
            tags: { some: { tagId: activeTag.id } },
          },
        },
        orderBy: { product: { name: "asc" } },
        include: { product: { include: productInclude } },
      });
    } catch (e) {
      console.error("[ShopCollectionPage] listings (tag)", e);
      return <ShopDataLoadError cause={e} />;
    }

    const products = listings.map((l) => productCardProductFromListing(l));

    return (
      <div>
        <p className="text-xs text-zinc-500">
          <Link href={base} className="hover:text-blue-400/90">
            {collection === CatalogGroup.sub ? "Sub collection" : "Domme collection"}
          </Link>
          <span className="mx-1.5 text-zinc-600">/</span>
          <span className="text-zinc-400">{activeTag.name}</span>
        </p>
        <h1 className="store-dimension-page-title mt-2 text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
          {activeTag.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          <Link
            href={shopUniversalTagHref(shopSlug, activeTag.slug)}
            className="text-blue-400/90 hover:underline"
          >
            View this tag across all products
          </Link>
        </p>
        <FeaturedProductsCarousel
          items={productsToFeaturedCarouselItems(products)}
          label={`Featured in ${activeTag.name}`}
        />
        {products.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-600">
            No products with this tag in this collection yet.
          </p>
        ) : (
          <ul className="mt-8 grid justify-center gap-3 [grid-template-columns:repeat(auto-fill,175px)] sm:justify-start">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} shopSlug={shopSlug} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  let listings;
  try {
    listings = await prisma.shopListing.findMany({
      where: {
        shopId: shop.id,
        active: true,
        product: { active: true, audience },
      },
      orderBy: { product: { name: "asc" } },
      include: { product: { include: productInclude } },
    });
  } catch (e) {
    console.error("[ShopCollectionPage] listings (collection)", e);
    return <ShopDataLoadError cause={e} />;
  }

  const allProducts = listings.map((l) => productCardProductFromListing(l));

  const byItemSections = buildByItemOnePerTag(allProducts, tags, {
    catalog: collection === CatalogGroup.sub ? "sub" : "domme",
  });
  const byDesignSections = buildByDesignOnePerName(allProducts);

  const title =
    collection === CatalogGroup.sub ? "Sub collection" : "Domme collection";

  const allProductsHref =
    shopSlug === PLATFORM_SHOP_SLUG ? SHOP_ALL_ROUTE : shopAllProductsHref(shopSlug);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="store-dimension-page-title text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
            {title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Browse by item tag and by design name below, use the tag menu for full lists, or{" "}
            <Link href={allProductsHref} className="text-blue-400/90 hover:underline">
              view all products
            </Link>
            .{" "}
            <Link href="/" className="text-zinc-500 hover:text-blue-400/90">
              Home
            </Link>
          </p>
        </div>
      </div>

      <FeaturedProductsCarousel
        items={productsToFeaturedCarouselItems(allProducts)}
        label={
          collection === CatalogGroup.sub
            ? "Featured in Sub collection"
            : "Featured in Domme collection"
        }
      />

      <ShopByItemAndDesignBrowse
        shopSlug={shopSlug}
        byItemSections={byItemSections}
        byDesignSections={byDesignSections}
        viewAllHrefForTag={(slug) =>
          shopCollectionTagHref(
            shopSlug,
            collection === CatalogGroup.sub ? "sub" : "domme",
            slug,
          )
        }
        emptyMessage="No products in this collection yet. Import or sync in admin, assign tags, or browse all products."
      />

      {collection === CatalogGroup.domme ? (
        <div className="mt-6 border-t border-zinc-800 pt-6">
          <DommeMerchWebsitePromo />
        </div>
      ) : null}
    </div>
  );
}
