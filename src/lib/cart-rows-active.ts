import { prisma } from "@/lib/prisma";
import type { Product, Tag } from "@/generated/prisma/client";
import { getCartSessionReadonly } from "@/lib/session";
import {
  cartLineUnitPriceCents,
  cartLineVariantSubtitle,
} from "@/lib/printify-variants";

export type ActiveCartRowProduct = Product & { primaryTag: Tag | null };

export type ActiveCartRow = {
  product: ActiveCartRowProduct;
  quantity: number;
  line: number;
  unit: number;
  variantSub: string | null;
};

export async function loadActiveCartRows(): Promise<{
  rows: ActiveCartRow[];
  subtotal: number;
}> {
  const session = await getCartSessionReadonly();
  const ids = Object.keys(session.items).filter(
    (id) => (session.items[id]?.quantity ?? 0) > 0,
  );
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, active: true },
    include: { primaryTag: true },
  });

  const rows: ActiveCartRow[] = products.map((p) => {
    const cartLine = session.items[p.id];
    const q = cartLine?.quantity ?? 0;
    const unit = cartLineUnitPriceCents(p, cartLine);
    const line = unit * q;
    return {
      product: p,
      quantity: q,
      line,
      unit,
      variantSub: cartLineVariantSubtitle(p, cartLine) ?? null,
    };
  });
  const subtotal = rows.reduce((s, r) => s + r.line, 0);
  return { rows, subtotal };
}
