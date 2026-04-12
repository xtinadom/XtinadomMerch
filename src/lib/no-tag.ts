import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** Canonical slug for the default “no user tag” label. */
export const NO_TAG_SLUG = "no-tag";

function displayNameNoTag(): string {
  return "No tag";
}

/**
 * Ensures the shop has a `no-tag` row and returns its id (for default product tagging).
 * Cached per request to avoid repeated upserts during bulk Printify sync.
 */
export const resolveNoTagId = cache(async (): Promise<string> => {
  const maxSo = await prisma.tag.aggregate({ _max: { sortOrder: true } });
  const sortOrder = Math.max(9990, (maxSo._max.sortOrder ?? 0) + 1);
  const row = await prisma.tag.upsert({
    where: { slug: NO_TAG_SLUG },
    create: {
      slug: NO_TAG_SLUG,
      name: displayNameNoTag(),
      sortOrder,
    },
    update: {},
    select: { id: true },
  });
  return row.id;
});

/**
 * Dedupes tag ids, applies “no tag” default when empty, and drops `noTagId` when any real tag remains.
 */
export function normalizeProductTagIds(
  tagIds: string[],
  noTagId: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tagIds) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  if (out.length === 0) return [noTagId];
  if (out.length > 1 && out.includes(noTagId)) {
    return out.filter((id) => id !== noTagId);
  }
  return out;
}

export function tagSlugIsNoTag(slug: string): boolean {
  return slug.trim().toLowerCase() === NO_TAG_SLUG;
}
