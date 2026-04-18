import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { slugify } from "@/lib/slugify";

/**
 * Allocates a unique `Shop.slug` from user-facing input (username / handle).
 * Excludes an existing shop id when renaming so the current slug does not count as “taken”.
 */
export async function allocateUniqueShopSlug(
  raw: string,
  excludeShopId?: string,
): Promise<{ slug: string } | { error: string }> {
  const base = slugify(raw.trim());
  if (!base || base === PLATFORM_SHOP_SLUG) {
    return {
      error: "That username resolves to a reserved or invalid URL. Try a different one.",
    };
  }
  for (let n = 0; n < 40; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await prisma.shop.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken || taken.id === excludeShopId) {
      return { slug: candidate };
    }
  }
  return {
    error: "Could not allocate a unique shop URL from that username. Try a shorter or different one.",
  };
}
