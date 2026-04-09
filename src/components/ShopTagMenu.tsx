"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  SHOP_ALL_ROUTE,
  SHOP_SUB_ROUTE,
  SHOP_DOMME_ROUTE,
  SUB_COLLECTION_NAV_LABEL,
  DOMME_COLLECTION_NAV_LABEL,
} from "@/lib/constants";
import type { Tag } from "@/generated/prisma/client";

type Row = Pick<Tag, "id" | "slug" | "name" | "sortOrder">;

export function ShopTagMenu({ tags }: { tags: Row[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sortedTags = useMemo(
    () =>
      [...tags].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    [tags],
  );

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
              href={SHOP_ALL_ROUTE}
              role="menuitem"
              className="block px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
              onClick={close}
            >
              All products
            </Link>
          </li>
          <li role="none" className="border-b border-zinc-800 pb-1 pt-1">
            <Link
              href={SHOP_SUB_ROUTE}
              role="menuitem"
              className="block px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              onClick={close}
            >
              {SUB_COLLECTION_NAV_LABEL}
            </Link>
            <ul className="mt-0.5 space-y-0.5" role="group">
              {sortedTags.map((t) => (
                <li key={t.id} role="none">
                  <Link
                    role="menuitem"
                    href={`${SHOP_SUB_ROUTE}/tag/${t.slug}`}
                    className="block py-1.5 pl-6 pr-4 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    onClick={close}
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          <li role="none" className="border-b border-zinc-800 pb-1 pt-1">
            <Link
              href={SHOP_DOMME_ROUTE}
              role="menuitem"
              className="block px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              onClick={close}
            >
              {DOMME_COLLECTION_NAV_LABEL}
            </Link>
            <ul className="mt-0.5 space-y-0.5" role="group">
              {sortedTags.map((t) => (
                <li key={t.id} role="none">
                  <Link
                    role="menuitem"
                    href={`${SHOP_DOMME_ROUTE}/tag/${t.slug}`}
                    className="block py-1.5 pl-6 pr-4 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    onClick={close}
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          <li role="none" className="pt-1">
            <p className="px-4 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              Tags (all items)
            </p>
            <ul className="mt-0.5 space-y-0.5" role="group">
              {sortedTags.map((t) => (
                <li key={`all-${t.id}`} role="none">
                  <Link
                    role="menuitem"
                    href={`/shop/tag/${t.slug}`}
                    className="block py-1.5 pl-6 pr-4 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    onClick={close}
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      )}
    </div>
  );
}
