"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  SUB_CATALOG_CATEGORY_SLUGS,
  SUB_COLLECTION_NAV_LABEL,
  SUB_COLLECTION_ROUTE,
  DOMME_COLLECTION_SLUGS,
  DOMME_COLLECTION_NAV_LABEL,
  DOMME_COLLECTION_ROUTE,
  dommeCollectionSortIndex,
} from "@/lib/constants";

type Cat = { id: string; slug: string; name: string; sortOrder: number };

function NavGroup({
  label,
  parentHref,
  items,
  onNavigate,
}: {
  label: string;
  parentHref: string;
  items: Cat[];
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <li role="none" className="border-b border-zinc-800 pb-1 last:border-b-0 last:pb-0">
      <Link
        href={parentHref}
        role="menuitem"
        className="block px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        onClick={onNavigate}
      >
        {label}
      </Link>
      <ul className="mt-0.5 space-y-0.5" role="group" aria-label={label}>
        {items.map((c) => (
          <li key={c.id} role="none">
            <Link
              role="menuitem"
              href={`/category/${c.slug}`}
              className="block py-1.5 pl-6 pr-4 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
              onClick={onNavigate}
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function CategoryMenu({ categories }: { categories: Cat[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { subCollectionItems, dommeCollectionItems, topLevelItems } = useMemo(() => {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const sub: Cat[] = [];
    const domme: Cat[] = [];
    const top: Cat[] = [];
    for (const c of sorted) {
      if (SUB_CATALOG_CATEGORY_SLUGS.has(c.slug)) sub.push(c);
      else if (DOMME_COLLECTION_SLUGS.has(c.slug)) domme.push(c);
      else top.push(c);
    }
    domme.sort(
      (a, b) =>
        dommeCollectionSortIndex(a.slug) - dommeCollectionSortIndex(b.slug),
    );
    return {
      subCollectionItems: sub,
      dommeCollectionItems: domme,
      topLevelItems: top,
    };
  }, [categories]);

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
        Categories
        <span className="text-xs opacity-70">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <ul
          className="absolute right-0 z-[1002] mt-2 min-w-[15rem] rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-xl"
          role="menu"
        >
          <NavGroup
            label={SUB_COLLECTION_NAV_LABEL}
            parentHref={SUB_COLLECTION_ROUTE}
            items={subCollectionItems}
            onNavigate={close}
          />
          <NavGroup
            label={DOMME_COLLECTION_NAV_LABEL}
            parentHref={DOMME_COLLECTION_ROUTE}
            items={dommeCollectionItems}
            onNavigate={close}
          />
          {topLevelItems.map((c) => (
            <li key={c.id} role="none">
              <Link
                role="menuitem"
                href={`/category/${c.slug}`}
                className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={close}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
