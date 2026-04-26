import type { Tag } from "@/generated/prisma/client";

export type ProductWithTags = {
  tags: { tagId: string; tag?: Tag }[];
  primaryTagId: string | null;
  primaryTag?: Tag | null;
};

/**
 * Tag ids for admin forms (order = primary first, then extras).
 * Merges `primaryTagId` when it is missing from `ProductTag` rows so the UI matches the DB
 * after partial updates or older sync paths — otherwise the form can submit with no `tagIds`,
 * skipping `updateProductDetails` tag writes, and Printify sync can re-apply the import default tag.
 */
export function productTagIds(p: ProductWithTags): string[] {
  const fromJoin = p.tags.map((t) => t.tagId);
  const primary = p.primaryTagId?.trim();
  if (primary && !fromJoin.includes(primary)) {
    return [primary, ...fromJoin];
  }
  return fromJoin;
}

/** Product appears under tag filter if it has that tag (junction or primary). */
export function productHasTag(p: ProductWithTags, tagId: string): boolean {
  const primary = p.primaryTagId?.trim();
  if (primary && primary === tagId) return true;
  return p.tags.some((t) => t.tagId === tagId);
}

export function cardLabelTag(p: ProductWithTags): Tag | null {
  if (p.primaryTag) return p.primaryTag;
  const first = p.tags[0]?.tag;
  return first ?? null;
}
