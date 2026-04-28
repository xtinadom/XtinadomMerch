import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreTagsForShop } from "@/lib/store-tags";
import { ProductCard } from "@/components/ProductCard";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { shopAllProductsHref } from "@/lib/marketplace-constants";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopSlug: string; slug: string }> };

const productInclude = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

export default async function ShopTenantUniversalTagPage({ params }: Props) {
  const { shopSlug, slug } = await params;
  const shop = await prisma.shop.findFirst({
    where: { slug: shopSlug, active: true },
  });
  if (!shop) notFound();

  const tags = await getStoreTagsForShop(shop.id);
  let activeTag = tags.find((t) => t.slug === slug) ?? null;
  if (!activeTag) {
    try {
      const t = await prisma.tag.findUnique({ where: { slug } });
      if (!t) notFound();
      activeTag = t;
    } catch (e) {
      console.error("[ShopTenantUniversalTagPage] resolve tag", e);
      return <ShopDataLoadError cause={e} />;
    }
  }

  let listings;
  try {
    listings = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        product: {
          active: true,
          OR: [
            { primaryTagId: activeTag.id },
            { tags: { some: { tagId: activeTag.id } } },
          ],
        },
      },
      orderBy: { product: { name: "asc" } },
      include: {
        product: { include: productInclude },
        shop: { select: { slug: true, displayName: true } },
      },
    });
  } catch (e) {
    console.error("[ShopTenantUniversalTagPage] listings", e);
    return <ShopDataLoadError cause={e} />;
  }

  const allHref = shopAllProductsHref(shopSlug);

  return (
    <div>
      <p className="text-xs text-zinc-500">
        <Link href={allHref} className="hover:text-blue-400/90">
          All products
        </Link>
        <span className="mx-1.5 text-zinc-600">/</span>
        <span className="text-zinc-400">{activeTag.name}</span>
      </p>
      <h1 className="store-dimension-page-title mt-2 text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
        {activeTag.name}
      </h1>

      {listings.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600">No products with this tag yet.</p>
      ) : (
        <ul className="mx-auto mt-8 flex max-w-full flex-wrap justify-center gap-3">
          {listings.map((l) => (
            <li key={l.id} className="w-[175px] shrink-0">
              <ProductCard product={productCardProductFromListing(l)} showShopName />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
