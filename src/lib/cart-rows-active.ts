import { prisma } from "@/lib/prisma";
import type { Product, Tag } from "@/generated/prisma/client";
import { getCartSessionReadonly } from "@/lib/session";
import { cartLineVariantSubtitle } from "@/lib/printify-variants";
import { listingCartUnitCents } from "@/lib/listing-cart-price";
import { productHref } from "@/lib/marketplace-constants";

export type ActiveCartRowProduct = Product & { primaryTag: Tag | null };

export type ActiveCartRow = {
  listingId: string;
  shopSlug: string;
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
  if (ids.length === 0) {
    return { rows: [], subtotal: 0 };
  }

  const listings = await prisma.shopListing.findMany({
    where: { id: { in: ids }, active: true },
    include: {
      shop: { select: { slug: true } },
      product: {
        include: {
          primaryTag: true,
          tags: { include: { tag: true } },
        },
      },
    },
  });

  const rows: ActiveCartRow[] = listings.map((listing) => {
    const p = listing.product;
    const cartLine = session.items[listing.id];
    const q = cartLine?.quantity ?? 0;
    const unit = listingCartUnitCents(listing, cartLine);
    const line = unit * q;
    return {
      listingId: listing.id,
      shopSlug: listing.shop.slug,
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

export function cartRowProductHref(row: ActiveCartRow): string {
  return productHref(row.shopSlug, row.product.slug);
}
