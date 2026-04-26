"use client";

import Link from "next/link";
import { useState } from "react";
import { ShopTagMenu } from "@/components/ShopTagMenu";
import { CartDrawer } from "@/components/CartDrawer";
import type { Tag } from "@/generated/prisma/client";
import { PLATFORM_SHOP_SLUG, shopCartHref } from "@/lib/marketplace-constants";

type TagRow = Pick<Tag, "id" | "slug" | "name" | "sortOrder">;

function dashboardLinkFallbackFromEmail(email: string) {
  const i = email.indexOf("@");
  return i > 0 ? email.slice(0, i) : email;
}

export function StoreNav({
  tags,
  cartQty,
  shopSlug,
  showBrowseMenu = true,
  shopOwnerEmail,
  shopOwnerDisplayName,
}: {
  tags: TagRow[];
  cartQty: number;
  /** When omitted, use legacy platform URLs (`/shop/...`). */
  shopSlug?: string;
  /** Tag dropdown (“Browse”); set false on marketing home. */
  showBrowseMenu?: boolean;
  /** Shop owner session email; when set, replaces “Log In” on platform. */
  shopOwnerEmail?: string;
  /** Shop display name for the dashboard link (preferred over email local-part). */
  shopOwnerDisplayName?: string;
}) {
  const [cartOpen, setCartOpen] = useState(false);
  const tenant = shopSlug && shopSlug !== PLATFORM_SHOP_SLUG;
  const fullCartHref = shopCartHref(shopSlug ?? PLATFORM_SHOP_SLUG);

  return (
    <>
      <header className="relative z-[1000] border-b border-zinc-800/40 bg-zinc-950/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1124px] items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 shrink-0 items-center gap-4 sm:gap-5">
            <Link
              href="/"
              className="store-dimension-brand text-xs uppercase tracking-[0.2em] text-blue-400/80 transition hover:text-blue-300/90"
            >
              XTINADOM
            </Link>
            {shopOwnerEmail ? (
              <Link
                href="/dashboard"
                className="min-w-0 max-w-[11rem] truncate text-xs font-medium tracking-wide text-zinc-400 transition hover:text-white sm:max-w-[14rem]"
                title={
                  shopOwnerDisplayName
                    ? `${shopOwnerDisplayName} (${shopOwnerEmail})`
                    : shopOwnerEmail
                }
              >
                {shopOwnerDisplayName ?? dashboardLinkFallbackFromEmail(shopOwnerEmail)}
              </Link>
            ) : !tenant ? (
              <Link
                href="/dashboard/login"
                className="shrink-0 text-xs font-medium tracking-wide text-zinc-400 transition hover:text-white"
              >
                Log In
              </Link>
            ) : null}
          </div>
          <nav className="flex flex-1 flex-wrap items-center justify-end gap-x-5 gap-y-2 sm:gap-x-7">
            <Link
              href="/shops"
              className="store-nav-link text-zinc-400 transition hover:text-white"
            >
              Shops
            </Link>
            {showBrowseMenu ? <ShopTagMenu tags={tags} shopSlug={shopSlug} /> : null}
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
          </nav>
        </div>
      </header>
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        fullCartHref={fullCartHref}
      />
    </>
  );
}
