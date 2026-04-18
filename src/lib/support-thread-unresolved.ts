import { SupportMessageAuthor } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

/**
 * Shop ids whose support thread needs admin attention: has at least one message and either never
 * marked resolved, or the creator posted again after `resolvedAt`.
 */
export async function supportUnresolvedThreadShopIdsExcludingPlatform(): Promise<Set<string>> {
  const threads = await prisma.supportThread.findMany({
    where: {
      shop: { slug: { not: PLATFORM_SHOP_SLUG } },
      messages: { some: {} },
    },
    select: {
      shopId: true,
      resolvedAt: true,
      messages: {
        select: { authorRole: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const out = new Set<string>();
  for (const t of threads) {
    const ra = t.resolvedAt;
    if (ra == null) {
      out.add(t.shopId);
      continue;
    }
    const hasCreatorAfter = t.messages.some(
      (m) => m.authorRole === SupportMessageAuthor.creator && m.createdAt > ra,
    );
    if (hasCreatorAfter) out.add(t.shopId);
  }
  return out;
}
