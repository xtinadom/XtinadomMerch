import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { encodeBaselinePickItem } from "@/lib/shop-baseline-catalog";

const PICK_PREFIX = "ab|";

/**
 * Ordered tag ids assigned to an admin baseline catalog item.
 */
export async function tagIdsForAdminCatalogItem(adminCatalogItemId: string): Promise<string[]> {
  const rows = await prisma.adminCatalogItemTag.findMany({
    where: { adminCatalogItemId },
    include: { tag: { select: { id: true, sortOrder: true, name: true } } },
  });
  rows.sort((a, b) => {
    const o = a.tag.sortOrder - b.tag.sortOrder;
    if (o !== 0) return o;
    return a.tag.name.localeCompare(b.tag.name);
  });
  return rows.map((r) => r.tagId);
}

/**
 * Shop listings whose `baselineCatalogPickEncoded` refers to this admin catalog item
 * (item pick or legacy variant / all-variant encodings share the same item id prefix).
 */
async function baselineListingsForCatalogItem(adminCatalogItemId: string) {
  const exactItemPick = encodeBaselinePickItem(adminCatalogItemId);
  const prefix = `${PICK_PREFIX}${adminCatalogItemId}|`;
  return prisma.shopListing.findMany({
    where: {
      baselineCatalogPickEncoded: { not: null },
      OR: [
        { baselineCatalogPickEncoded: exactItemPick },
        { baselineCatalogPickEncoded: { startsWith: prefix } },
      ],
    },
    select: {
      productId: true,
      shop: { select: { slug: true } },
    },
  });
}

/**
 * Replaces `ProductTag` rows and `primaryTagId` so storefront tag browse (`product.tags`) matches
 * the admin catalog item. Only for products tied to baseline listings for this catalog item.
 */
export async function applyCatalogTagsToProduct(productId: string, tagIds: string[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.productTag.deleteMany({ where: { productId } });
    if (tagIds.length > 0) {
      await tx.productTag.createMany({
        data: tagIds.map((tagId) => ({ productId, tagId })),
        skipDuplicates: true,
      });
    }
    await tx.product.update({
      where: { id: productId },
      data: { primaryTagId: tagIds[0] ?? null },
    });
  });
}

function revalidateAfterBaselineTagSync(params: {
  shopSlugs: string[];
  tagSlugs: string[];
}): void {
  const { shopSlugs, tagSlugs } = params;
  revalidatePath("/shop/all");
  for (const slug of tagSlugs) {
    revalidatePath(`/shop/tag/${slug}`);
  }
  for (const shopSlug of shopSlugs) {
    revalidatePath(`/s/${shopSlug}`);
    for (const tagSlug of tagSlugs) {
      revalidatePath(`/s/${shopSlug}/tag/${tagSlug}`);
    }
  }
}

/**
 * Copies admin catalog tags onto every stub/live product used by shop listings that reference
 * `adminCatalogItemId` in `baselineCatalogPickEncoded`, then revalidates storefront tag routes.
 */
export async function syncProductTagsFromAdminCatalogItemId(adminCatalogItemId: string): Promise<void> {
  const tagIds = await tagIdsForAdminCatalogItem(adminCatalogItemId);
  const tagRows =
    tagIds.length > 0
      ? await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { slug: true } })
      : [];
  const tagSlugs = tagRows.map((t) => t.slug);

  const listings = await baselineListingsForCatalogItem(adminCatalogItemId);
  const seenProduct = new Set<string>();
  for (const row of listings) {
    if (seenProduct.has(row.productId)) continue;
    seenProduct.add(row.productId);
    await applyCatalogTagsToProduct(row.productId, tagIds);
  }

  const shopSlugs = [...new Set(listings.map((l) => l.shop.slug))];
  const slugsForRevalidate = shopSlugs.includes(PLATFORM_SHOP_SLUG)
    ? shopSlugs
    : [...shopSlugs, PLATFORM_SHOP_SLUG];
  revalidateAfterBaselineTagSync({ shopSlugs: slugsForRevalidate, tagSlugs });
}

/**
 * After a new baseline listing is created, copy catalog tags onto its product.
 */
export async function syncProductTagsForNewBaselineListing(params: {
  adminCatalogItemId: string;
  productId: string;
  shopSlug: string;
}): Promise<void> {
  const tagIds = await tagIdsForAdminCatalogItem(params.adminCatalogItemId);
  await applyCatalogTagsToProduct(params.productId, tagIds);
  const tagRows =
    tagIds.length > 0
      ? await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { slug: true } })
      : [];
  const tagSlugs = tagRows.map((t) => t.slug);
  revalidateAfterBaselineTagSync({
    shopSlugs: [params.shopSlug, PLATFORM_SHOP_SLUG],
    tagSlugs,
  });
}
