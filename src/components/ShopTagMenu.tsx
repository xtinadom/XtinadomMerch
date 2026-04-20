"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo, useId } from "react";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import type { Tag } from "@/generated/prisma/client";
import {
  PLATFORM_SHOP_SLUG,
  shopAllProductsHref,
  shopUniversalTagHref,
} from "@/lib/marketplace-constants";

type Row = Pick<Tag, "id" | "slug" | "name" | "sortOrder">;

export function ShopTagMenu({
  tags,
  shopSlug,
}: {
  tags: Row[];
  shopSlug?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const tagSearchId = useId();
  const tenant = shopSlug && shopSlug !== PLATFORM_SHOP_SLUG;
  const allHref = tenant ? shopAllProductsHref(shopSlug) : SHOP_ALL_ROUTE;

  const sortedTags = useMemo(
    () =>
      [...tags].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    [tags],
  );

  const filteredTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return sortedTags;
    return sortedTags.filter(
      (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
    );
  }, [sortedTags, tagQuery]);

  useEffect(() => {
    if (!open) setTagQuery("");
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const close = () => setOpen(false);

  return (
    <div className="relative z-[1001]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="store-nav-link flex items-center gap-1 text-zinc-400 transition hover:text-white"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Browse
        <span className="text-[10px] opacity-70">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <ul
          className="store-dimension-panel absolute right-0 z-[1002] mt-3 max-h-[min(70vh,28rem)] min-w-[17rem] overflow-y-auto py-2 shadow-2xl"
          role="menu"
        >
          <li role="none" className="border-b border-zinc-800 pb-1">
            <Link
              href={allHref}
              role="menuitem"
              className="block px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
              onClick={close}
            >
              All products
            </Link>
          </li>
          <li role="none" className="pt-1">
            <p className="px-4 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              By tag
            </p>
            <div className="px-3 pb-2 pt-0.5">
              <label htmlFor={tagSearchId} className="sr-only">
                Search tags
              </label>
              <input
                id={tagSearchId}
                type="search"
                inputMode="search"
                autoComplete="off"
                spellCheck={false}
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder="Search tags…"
                className="w-full rounded-md border border-zinc-700/90 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <ul className="mt-0.5 space-y-0.5" role="group">
              {filteredTags.length === 0 ? (
                <li role="none" className="px-4 py-2 text-sm text-zinc-500">
                  {sortedTags.length === 0 ? "No tags yet." : "No tags match your search."}
                </li>
              ) : (
                filteredTags.map((t) => (
                  <li key={t.id} role="none">
                    <Link
                      role="menuitem"
                      href={shopUniversalTagHref(shopSlug ?? PLATFORM_SHOP_SLUG, t.slug)}
                      className="block py-1.5 pl-6 pr-4 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      onClick={close}
                    >
                      {t.name}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </li>
        </ul>
      )}
    </div>
  );
}
