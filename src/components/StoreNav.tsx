"use client";

import Link from "next/link";
import { useState } from "react";
import { ShopTagMenu } from "@/components/ShopTagMenu";
import { CartDrawer } from "@/components/CartDrawer";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import type { Tag } from "@/generated/prisma/client";

type TagRow = Pick<Tag, "id" | "slug" | "name" | "sortOrder">;

export function StoreNav({
  tags,
  cartQty,
}: {
  tags: TagRow[];
  cartQty: number;
}) {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <header className="relative z-[1000] border-b border-zinc-800/40 bg-zinc-950/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/"
            className="store-dimension-brand text-xs uppercase tracking-[0.2em] text-blue-400/80 transition hover:text-blue-300/90"
          >
            XTINADOM
          </Link>
          <nav className="flex flex-1 items-center justify-end gap-5 sm:gap-7">
            <Link
              href={SHOP_ALL_ROUTE}
              className="store-nav-link text-zinc-400 transition hover:text-white"
            >
              All products
            </Link>
            <ShopTagMenu tags={tags} />
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="store-nav-link inline-flex items-center gap-1.5 text-zinc-400 transition hover:text-white"
            >
              Cart
              {cartQty > 0 ? (
                <span
                  className="min-w-[1.25rem] rounded-full bg-blue-900/90 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-blue-100 tabular-nums"
                  aria-label={`${cartQty} items in cart`}
                >
                  {cartQty > 99 ? "99+" : cartQty}
                </span>
              ) : null}
            </button>
            <Link
              href="/admin"
              className="store-kicker text-zinc-600 transition hover:text-zinc-400"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
