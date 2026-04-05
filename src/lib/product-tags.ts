import type { Tag } from "@/generated/prisma/client";

export type ProductWithTags = {
  tags: { tagId: string; tag?: Tag }[];
  primaryTagId: string | null;
  primaryTag?: Tag | null;
};

export function productTagIds(p: ProductWithTags): string[] {
  return p.tags.map((t) => t.tagId);
}

/** Product appears under tag filter if it has that tag. */
export function productHasTag(p: ProductWithTags, tagId: string): boolean {
  return p.tags.some((t) => t.tagId === tagId);
}

export function cardLabelTag(p: ProductWithTags): Tag | null {
  if (p.primaryTag) return p.primaryTag;
  const first = p.tags[0]?.tag;
  return first ?? null;
}
