import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FeaturedSpotlightCard } from "@/components/FeaturedSpotlightCard";
import { DommeMerchWebsitePromo } from "@/components/DommeMerchWebsitePromo";
import { Audience, CatalogGroup } from "@/generated/prisma/enums";
import {
  COLLECTION_GROUP_DOMME,
  COLLECTION_GROUP_SUB,
  DOMME_COLLECTION_NAV_LABEL,
  SUB_COLLECTION_NAV_LABEL,
  dommeCollectionSortIndex,
} from "@/lib/constants";
import { catalogRootIdsForGroup } from "@/lib/catalog-group";
import { collectDescendantCategoryIdsFromRoots } from "@/lib/category-tree";
import { productListedInCategory } from "@/lib/product-categories";

export const dynamic = "force-dynamic";

/** Pool per category for spotlight; showcase uses first 3 across the collection. */
const FEATURED_PER_CATEGORY = 3;
const FEATURED_SPOTLIGHT_COUNT = 3;

function dedupeSpotlightByProduct<T extends { id: string }>(items: T[], max: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of items) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

type Props = { params: Promise<{ group: string }> };

function CollectionCategoryRow({
  slug,
  name,
  description,
  featuredCount,
  fullCount,
}: {
  slug: string;
  name: string;
  description: string | null;
  featuredCount: number;
  fullCount: number;
}) {
  const countLabel =
    fullCount === 0
      ? "No items yet"
      : fullCount === 1
        ? "1 item"
        : `${fullCount} items`;

  const moreInCategory = fullCount > featuredCount;

  return (
    <li>
      <Link
        href={`/category/${slug}`}
        className="block rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 transition hover:border-zinc-600 hover:bg-zinc-900/50"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <span className="text-base font-medium text-zinc-100">{name}</span>
            {description ? (
              <p className="mt-1 text-sm text-zinc-500">{description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
            <span className="text-xs text-zinc-500">{countLabel}</span>
            {moreInCategory ? (
              <span className="text-[11px] text-zinc-600">
                + more in this category — open for full list
              </span>
            ) : (
              <span className="text-xs text-rose-400/90">Browse →</span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

async function SubCollectionSplash() {
  const allCats = await prisma.category.findMany({
    select: { id: true, slug: true, parentId: true, sortOrder: true, catalogGroup: true },
  });
  const expandedIds = collectDescendantCategoryIdsFromRoots(
    catalogRootIdsForGroup(CatalogGroup.sub, allCats),
    allCats,
  );

  const categories = await prisma.category.findMany({
    where: { id: { in: expandedIds } },
    orderBy: { sortOrder: "asc" },
  });

  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { categoryId: { in: expandedIds } },
        { extraCategories: { some: { categoryId: { in: expandedIds } } } },
      ],
    },
    orderBy: { name: "asc" },
    include: { category: true, extraCategories: true },
  });

  const byCat = new Map<string, typeof products>();
  for (const id of expandedIds) byCat.set(id, []);
  for (const p of products) {
    for (const cid of expandedIds) {
      if (productListedInCategory(p, cid)) byCat.get(cid)!.push(p);
    }
  }
  for (const [cid, list] of byCat) {
    const seen = new Set<string>();
    byCat.set(
      cid,
      list.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))),
    );
  }

  const categoriesWith = categories.map((cat) => {
    const full = byCat.get(cat.id) ?? [];
    return {
      ...cat,
      products: full.slice(0, FEATURED_PER_CATEGORY),
      fullCount: full.length,
    };
  });

  const spotlight = dedupeSpotlightByProduct(
    categoriesWith.flatMap((c) => c.products),
    FEATURED_SPOTLIGHT_COUNT,
  );
  const totalActive = new Set(products.map((p) => p.id)).size;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-50">{SUB_COLLECTION_NAV_LABEL}</h1>

      {spotlight.length > 0 ? (
        <section className="mt-10" aria-label="Featured products">
          <ul className="mx-auto flex list-none flex-wrap items-start justify-center gap-10 p-0 sm:gap-12">
            {spotlight.map((p, i) => (
              <FeaturedSpotlightCard key={p.id} product={p} index={i} />
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-10 text-sm text-zinc-600">No products in this collection yet.</p>
      )}

      <section className={spotlight.length > 0 ? "mt-14" : "mt-10"}>
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Categories</h2>
        <ul className="mt-4 space-y-3">
          {categoriesWith.map((cat) => (
            <CollectionCategoryRow
              key={cat.id}
              slug={cat.slug}
              name={cat.name}
              description={cat.description}
              featuredCount={cat.products.length}
              fullCount={cat.fullCount}
            />
          ))}
        </ul>
      </section>

      {totalActive > spotlight.length && spotlight.length > 0 && (
        <p className="mt-8 text-center text-sm text-zinc-500 sm:text-left">
          <Link href="/shop" className="text-rose-400/90 hover:underline">
            View full shop
          </Link>{" "}
          for every sub-catalog item ({totalActive} total).
        </p>
      )}
    </div>
  );
}

async function DommeCollectionSplash() {
  const dommeAudience = { not: Audience.sub } as const;

  const allDommeCats = await prisma.category.findMany({
    select: { id: true, slug: true, parentId: true, sortOrder: true, catalogGroup: true },
  });
  const dommeExpandedIds = collectDescendantCategoryIdsFromRoots(
    catalogRootIdsForGroup(CatalogGroup.domme, allDommeCats),
    allDommeCats,
  );

  const categories = await prisma.category.findMany({
    where: { id: { in: dommeExpandedIds } },
    orderBy: { sortOrder: "asc" },
  });

  const products = await prisma.product.findMany({
    where: {
      active: true,
      audience: dommeAudience,
      OR: [
        { categoryId: { in: dommeExpandedIds } },
        { extraCategories: { some: { categoryId: { in: dommeExpandedIds } } } },
      ],
    },
    orderBy: { name: "asc" },
    include: { category: true, extraCategories: true },
  });

  const byCat = new Map<string, typeof products>();
  for (const id of dommeExpandedIds) byCat.set(id, []);
  for (const p of products) {
    for (const cid of dommeExpandedIds) {
      if (productListedInCategory(p, cid)) byCat.get(cid)!.push(p);
    }
  }
  for (const [cid, list] of byCat) {
    const seen = new Set<string>();
    byCat.set(
      cid,
      list.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))),
    );
  }

  const categoriesWith = categories.map((cat) => {
    const full = byCat.get(cat.id) ?? [];
    return {
      ...cat,
      products: full.slice(0, FEATURED_PER_CATEGORY),
      fullCount: full.length,
    };
  });

  const sorted = [...categoriesWith].sort(
    (a, b) => dommeCollectionSortIndex(a.slug) - dommeCollectionSortIndex(b.slug),
  );

  /** Listed on /category; promo on this page covers website services. */
  const categoryRows = sorted.filter((c) => c.slug !== "domme-website-services");

  const spotlight = dedupeSpotlightByProduct(
    sorted.flatMap((c) => c.products),
    FEATURED_SPOTLIGHT_COUNT,
  );
  const totalActive = new Set(products.map((p) => p.id)).size;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-50">{DOMME_COLLECTION_NAV_LABEL}</h1>

      {spotlight.length > 0 ? (
        <section className="mt-10" aria-label="Featured products">
          <ul className="mx-auto flex list-none flex-wrap items-start justify-center gap-10 p-0 sm:gap-12">
            {spotlight.map((p, i) => (
              <FeaturedSpotlightCard key={p.id} product={p} index={i} />
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-10 text-sm text-zinc-600">No products in this collection yet.</p>
      )}

      <section className={spotlight.length > 0 ? "mt-14" : "mt-10"}>
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Categories</h2>
        <ul className="mt-4 space-y-3">
          {categoryRows.map((cat) => (
            <CollectionCategoryRow
              key={cat.id}
              slug={cat.slug}
              name={cat.name}
              description={cat.description}
              featuredCount={cat.products.length}
              fullCount={cat.fullCount}
            />
          ))}
        </ul>
      </section>

      {totalActive > spotlight.length && spotlight.length > 0 && (
        <p className="mt-8 text-center text-sm text-zinc-500 sm:text-left">
          <Link href="/shop" className="text-rose-400/90 hover:underline">
            View full shop
          </Link>{" "}
          for every Domme collection item ({totalActive} total).
        </p>
      )}

      <div className="mt-14">
        <DommeMerchWebsitePromo />
      </div>
    </div>
  );
}

export default async function CollectionGroupPage({ params }: Props) {
  const { group } = await params;

  if (group !== COLLECTION_GROUP_SUB && group !== COLLECTION_GROUP_DOMME) {
    notFound();
  }

  if (group === COLLECTION_GROUP_SUB) {
    return <SubCollectionSplash />;
  }

  return <DommeCollectionSplash />;
}
