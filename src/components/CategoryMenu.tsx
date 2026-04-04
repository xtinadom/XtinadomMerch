"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import { CatalogGroup } from "@/generated/prisma/enums";
import {
  SUB_COLLECTION_NAV_LABEL,
  SUB_COLLECTION_ROUTE,
  DOMME_COLLECTION_NAV_LABEL,
  DOMME_COLLECTION_ROUTE,
} from "@/lib/constants";
import {
  resolveRootCatalogGroup,
  sortSubRootCategories,
  sortDommeRootCategories,
  type CategoryNavRow,
} from "@/lib/catalog-group";

type Cat = CategoryNavRow;

function NavNestedGroup({
  label,
  parentHref,
  roots,
  all,
  onNavigate,
}: {
  label: string;
  parentHref: string;
  roots: Cat[];
  all: Cat[];
  onNavigate: () => void;
}) {
  if (roots.length === 0) return null;

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
        {roots.map((root) => {
          const children = all
            .filter((c) => c.parentId === root.id)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
          return (
            <li key={root.id} role="none">
              <Link
                role="menuitem"
                href={`/category/${root.slug}`}
                className="block py-1.5 pl-6 pr-4 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={onNavigate}
              >
                {root.name}
              </Link>
              {children.length > 0 ? (
                <ul
                  className="mt-0.5 border-l border-zinc-800/80 pl-2"
                  aria-label={`${root.name} subcategories`}
                >
                  {children.map((ch) => (
                    <li key={ch.id} role="none">
                      <Link
                        role="menuitem"
                        href={`/category/${ch.slug}`}
                        className="block py-1 pl-4 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        onClick={onNavigate}
                      >
                        {ch.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export function CategoryMenu({ categories }: { categories: Cat[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { subRoots, dommeRoots, topLevelItems } = useMemo(() => {
    const roots = categories.filter((c) => c.parentId === null);
    const sub = sortSubRootCategories(
      roots.filter((c) => resolveRootCatalogGroup(c) === CatalogGroup.sub),
    );
    const domme = sortDommeRootCategories(
      roots.filter((c) => resolveRootCatalogGroup(c) === CatalogGroup.domme),
    );
    const top = roots
      .filter((c) => resolveRootCatalogGroup(c) === null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return { subRoots: sub, dommeRoots: domme, topLevelItems: top };
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
          <NavNestedGroup
            label={SUB_COLLECTION_NAV_LABEL}
            parentHref={SUB_COLLECTION_ROUTE}
            roots={subRoots}
            all={categories}
            onNavigate={close}
          />
          <NavNestedGroup
            label={DOMME_COLLECTION_NAV_LABEL}
            parentHref={DOMME_COLLECTION_ROUTE}
            roots={dommeRoots}
            all={categories}
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
