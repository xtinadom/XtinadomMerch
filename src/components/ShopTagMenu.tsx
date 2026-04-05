"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import { CatalogGroup } from "@/generated/prisma/enums";
import {
  SHOP_SUB_ROUTE,
  SHOP_DOMME_ROUTE,
  SUB_SHOP_NAV_LABEL,
  DOMME_SHOP_NAV_LABEL,
} from "@/lib/constants";
import type { Tag } from "@/generated/prisma/client";

type Row = Pick<Tag, "id" | "slug" | "name" | "sortOrder" | "collection">;

export function ShopTagMenu({ tags }: { tags: Row[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { subTags, dommeTags } = useMemo(() => {
    const sub = tags
      .filter((t) => t.collection === CatalogGroup.sub)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const domme = tags
      .filter((t) => t.collection === CatalogGroup.domme)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return { subTags: sub, dommeTags: domme };
  }, [tags]);

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
        className="flex items-center gap-1 text-sm text-zinc-400 transition hover:text-zinc-100"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Browse by tag
        <span className="text-xs opacity-70">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <ul
          className="absolute right-0 z-[1002] mt-2 max-h-[min(70vh,24rem)] min-w-[14rem] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-xl"
          role="menu"
        >
          <li role="none" className="border-b border-zinc-800 pb-1">
            <Link
              href={SHOP_SUB_ROUTE}
              role="menuitem"
              className="block px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              onClick={close}
            >
              {SUB_SHOP_NAV_LABEL}
            </Link>
            <ul className="mt-0.5 space-y-0.5" role="group">
              {subTags.map((t) => (
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
          <li role="none" className="pt-1">
            <Link
              href={SHOP_DOMME_ROUTE}
              role="menuitem"
              className="block px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              onClick={close}
            >
              {DOMME_SHOP_NAV_LABEL}
            </Link>
            <ul className="mt-0.5 space-y-0.5" role="group">
              {dommeTags.map((t) => (
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
        </ul>
      )}
    </div>
  );
}
