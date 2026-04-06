/**
 * One-off: merge duplicate Tag rows after universal-tag migration or legacy data.
 *
 * 1) Same slug (case-insensitive): keep one tag (prefers slug without trailing -<n>, else lowest id).
 * 2) Slug like "mug-1" when "mug" exists: merge into the base slug tag.
 *
 * Does not merge by display name only (different slugs can share a name intentionally).
 *
 * Usage: npm run cleanup-tags   (or: npx tsx scripts/cleanup-duplicate-tags.ts)
 * Requires DATABASE_URL (or POSTGRES_PRISMA_URL) in env.
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

type T = { id: string; slug: string };

function pickCanonical(group: T[]): T {
  const noNumericSuffix = group.filter((t) => !/-\d+$/.test(t.slug));
  const pool = noNumericSuffix.length > 0 ? noNumericSuffix : group;
  return [...pool].sort((a, b) => a.id.localeCompare(b.id))[0]!;
}

async function mergeTagInto(targetId: string, sourceId: string): Promise<void> {
  if (targetId === sourceId) return;

  const links = await prisma.productTag.findMany({
    where: { tagId: sourceId },
  });

  for (const link of links) {
    const already = await prisma.productTag.findUnique({
      where: {
        productId_tagId: { productId: link.productId, tagId: targetId },
      },
    });
    await prisma.productTag.delete({
      where: {
        productId_tagId: { productId: link.productId, tagId: sourceId },
      },
    });
    if (!already) {
      await prisma.productTag.create({
        data: { productId: link.productId, tagId: targetId },
      });
    }
  }

  await prisma.product.updateMany({
    where: { primaryTagId: sourceId },
    data: { primaryTagId: targetId },
  });

  await prisma.tag.delete({ where: { id: sourceId } });
}

async function mergeSameSlugCaseInsensitive(): Promise<number> {
  let merged = 0;
  const tags = await prisma.tag.findMany({
    select: { id: true, slug: true },
    orderBy: { id: "asc" },
  });

  const byKey = new Map<string, T[]>();
  for (const t of tags) {
    const k = t.slug.toLowerCase();
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(t);
  }

  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const keep = pickCanonical(group);
    for (const t of group) {
      if (t.id === keep.id) continue;
      await mergeTagInto(keep.id, t.id);
      merged += 1;
    }
  }
  return merged;
}

async function mergeNumericSuffixSlugs(): Promise<number> {
  let total = 0;
  for (;;) {
    const tags = await prisma.tag.findMany({
      select: { id: true, slug: true },
    });
    const byLower = new Map(tags.map((t) => [t.slug.toLowerCase(), t] as const));

    let did = false;
    for (const t of tags) {
      const m = /^(.+)-(\d+)$/.exec(t.slug);
      if (!m) continue;
      const baseKey = m[1]!.toLowerCase();
      const base = byLower.get(baseKey);
      if (!base || base.id === t.id) continue;

      await mergeTagInto(base.id, t.id);
      total += 1;
      did = true;
      break;
    }
    if (!did) break;
  }
  return total;
}

async function main() {
  console.log("Cleaning duplicate tags…");

  const a = await mergeSameSlugCaseInsensitive();
  console.log(`  Case-insensitive slug duplicates merged: ${a}`);

  const b = await mergeNumericSuffixSlugs();
  console.log(`  Numeric suffix slugs (e.g. mug-1 → mug) merged: ${b}`);

  const left = await prisma.tag.count();
  console.log(`Done. ${left} tag(s) remaining.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
