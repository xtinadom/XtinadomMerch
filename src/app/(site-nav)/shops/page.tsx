import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  parseShopBrowseSort,
  sortShopsForBrowse,
} from "@/lib/shops-browse";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ sort?: string }>;
};

export default async function ShopsBrowsePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sort = parseShopBrowseSort(
    typeof sp.sort === "string" ? sp.sort : undefined,
  );

  let raw;
  try {
    raw = await prisma.shop.findMany({
      where: { active: true, slug: { not: PLATFORM_SHOP_SLUG } },
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

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-12">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-400/80">
          Domme Shops
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-50">Browse shops</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-500">
          Independent storefronts on the platform catalog. Default order highlights editorial picks
          and sales.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-zinc-600">Sort:</span>
        <Link
          href="/shops?sort=editorial"
          className={
            sort === "editorial"
              ? "rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-900"
              : "rounded-full border border-zinc-700 px-3 py-1 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          }
        >
          Editorial &amp; sales
        </Link>
        <Link
          href="/shops?sort=sales"
          className={
            sort === "sales"
              ? "rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-900"
              : "rounded-full border border-zinc-700 px-3 py-1 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          }
        >
          Sales only
        </Link>
        <Link
          href="/shops?sort=new"
          className={
            sort === "new"
              ? "rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-900"
              : "rounded-full border border-zinc-700 px-3 py-1 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          }
        >
          Newest
        </Link>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {shops.map((s) => (
          <li key={s.id}>
            <Link
              href={`/s/${s.slug}`}
              className="flex gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 transition hover:border-zinc-600"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
                {s.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.profileImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
                    No photo
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-medium text-zinc-100">{s.displayName}</h2>
                <p className="mt-0.5 font-mono text-xs text-zinc-500">/{s.slug}</p>
                {s.bio ? (
                  <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{s.bio}</p>
                ) : null}
                <p className="mt-2 text-[11px] text-zinc-600">
                  Lifetime sales {formatMoney(s.totalSalesCents)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {shops.length === 0 ? (
        <p className="mt-10 text-center text-sm text-zinc-500">
          No shops yet —{" "}
          <Link href="/create-shop" className="text-blue-400 hover:underline">
            create the first one
          </Link>
          .
        </p>
      ) : null}

      <p className="mt-12 text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Platform home
        </Link>
      </p>

      <SiteLegalFooter />
    </main>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
