import type { ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  parseShopBrowseSort,
  sortShopsForBrowse,
  type ShopBrowseSort,
} from "@/lib/shops-browse";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { shopsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { getShopsBrowsePageFeaturedCarouselShops } from "@/lib/shops-browse-page-featured";
import { ShopBrowseGrid } from "@/components/ShopBrowseGrid";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ sort?: string }>;
};

function sortHref(next: ShopBrowseSort): string {
  if (next === "sales") return "/shops";
  return `/shops?sort=${next}`;
}

function SortPill(props: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  const { href, active, children } = props;
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-blue-500/50 bg-blue-950/40 text-blue-100"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function ShopsBrowsePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sort = parseShopBrowseSort(typeof sp.sort === "string" ? sp.sort : undefined);

  let raw;
  try {
    raw = await prisma.shop.findMany({
      where: { active: true, listedOnShopsBrowse: true, slug: { not: PLATFORM_SHOP_SLUG } },
      select: {
        id: true,
        slug: true,
        displayName: true,
        profileImageUrl: true,
        bio: true,
        totalSalesCents: true,
        editorialPriority: true,
        editorialPinnedUntil: true,
        createdAt: true,
      },
    });
  } catch (e) {
    return <ShopDataLoadError cause={e} />;
  }

  const shops = sortShopsForBrowse(raw, sort);

  let featuredRows: Awaited<ReturnType<typeof getShopsBrowsePageFeaturedCarouselShops>> = [];
  try {
    featuredRows = await getShopsBrowsePageFeaturedCarouselShops(12);
  } catch (e) {
    console.warn("[ShopsBrowsePage] featured carousel load failed (migrations applied?)", e);
  }

  const seenFeatured = new Set(featuredRows.map((s) => s.id));
  const mergedFeatured = [...featuredRows];
  for (const s of shops) {
    if (mergedFeatured.length >= 12) break;
    if (seenFeatured.has(s.id)) continue;
    seenFeatured.add(s.id);
    mergedFeatured.push({
      id: s.id,
      slug: s.slug,
      displayName: s.displayName,
      profileImageUrl: s.profileImageUrl,
      bio: s.bio,
      totalSalesCents: s.totalSalesCents,
    });
  }

  const featuredCarouselItems = shopsToFeaturedCarouselItems(mergedFeatured);

  const gridShops = shops.map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.displayName,
    profileImageUrl: s.profileImageUrl,
    bio: s.bio,
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-[996px] flex-col px-4 py-12">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="store-dimension-page-title text-2xl !uppercase !tracking-[0.12em] text-zinc-50 sm:text-3xl">
            Creator shops
          </h1>
          <p className="mt-2 max-w-lg text-sm text-zinc-500">See what other creators are up to</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Sort</span>
          <SortPill href={sortHref("editorial")} active={sort === "editorial"}>
            Spotlight
          </SortPill>
          <SortPill href={sortHref("sales")} active={sort === "sales"}>
            Sales
          </SortPill>
          <SortPill href={sortHref("new")} active={sort === "new"}>
            New
          </SortPill>
        </div>
      </div>

      {featuredCarouselItems.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-2 text-center text-sm font-medium uppercase tracking-wide text-zinc-500">
            Featured shops
          </h2>
          <FeaturedProductsCarousel
            items={featuredCarouselItems}
            hideKicker
            label="Featured shops"
          />
        </section>
      ) : null}

      <section className="mt-2">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Top shops</h2>
        {gridShops.length === 0 ? (
          <p className="text-sm text-zinc-600">
            No shops yet —{" "}
            <Link href="/create-shop" className="text-blue-400 hover:underline">
              create the first one
            </Link>
            .
          </p>
        ) : (
          <ShopBrowseGrid shops={gridShops} />
        )}
      </section>

      <p className="mt-12 text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Platform home
        </Link>
      </p>

      <SiteLegalFooter />
    </main>
  );
}
