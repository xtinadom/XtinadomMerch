import { prisma } from "@/lib/prisma";
import type { CartSession } from "@/lib/session";

/** Units for active products only — matches cart view. */
export async function cartBadgeQuantity(
  items: CartSession["items"],
): Promise<number> {
  const ids = Object.keys(items).filter((id) => (items[id]?.quantity ?? 0) > 0);
  if (ids.length === 0) return 0;
  try {
    const rows = await prisma.product.findMany({
      where: { id: { in: ids }, active: true },
      select: { id: true },
    });
    const active = new Set(rows.map((r) => r.id));
    let n = 0;
    for (const id of ids) {
      if (active.has(id)) n += items[id]!.quantity;
    }
    return n;
  } catch (e) {
    console.error("[cartBadgeQuantity]", e);
    return 0;
  }
}
