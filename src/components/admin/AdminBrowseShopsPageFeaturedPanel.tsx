"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  adminSaveBrowseShopsPageFeaturedInitialState,
} from "@/actions/admin-browse-shops-page-featured-state";
import { adminSaveBrowseShopsPageFeaturedShopIdsForm } from "@/actions/admin-browse-shops-page-featured";
import { PLATFORM_ALL_PAGE_FEATURED_LIMIT } from "@/lib/platform-all-page-featured-constants";

export function AdminBrowseShopsPageFeaturedPanel(props: {
  shops: { id: string; displayName: string; slug: string }[];
  initialShopIds: string[];
}) {
  const { shops, initialShopIds } = props;
  const router = useRouter();
  const [ids, setIds] = useState<string[]>(initialShopIds);
  const [state, formAction] = useActionState(
    adminSaveBrowseShopsPageFeaturedShopIdsForm,
    adminSaveBrowseShopsPageFeaturedInitialState,
  );

  useEffect(() => {
    if (state.ok) void router.refresh();
  }, [state.ok, router]);

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shops) {
      m.set(s.id, `${s.displayName} — /${s.slug}`);
    }
    return m;
  }, [shops]);

  const available = useMemo(
    () => shops.filter((s) => !ids.includes(s.id)).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [shops, ids],
  );

  function remove(id: string) {
    setIds((prev) => prev.filter((x) => x !== id));
  }

  function add(id: string) {
    setIds((prev) => {
      if (prev.includes(id) || prev.length >= PLATFORM_ALL_PAGE_FEATURED_LIMIT) return prev;
      return [...prev, id];
    });
  }

  function move(idx: number, dir: -1 | 1) {
    setIds((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const t = next[idx]!;
      next[idx] = next[j]!;
      next[j] = t;
      return next;
    });
  }

  return (
    <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-zinc-100">Platform — Creator shops page (`/shops`)</h3>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500">
        Pick up to {PLATFORM_ALL_PAGE_FEATURED_LIMIT} shops for the featured carousel on{" "}
        <span className="font-mono text-zinc-400">/shops</span>. Order is priority. Remaining slots use total sales,
        then storefront home views, then any active creator shop.
      </p>

      {state.error ? (
        <p className="mt-3 rounded-md border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 rounded-md border border-emerald-900/50 bg-emerald-950/25 px-3 py-2 text-xs text-emerald-200/90">
          Saved. Refresh <span className="font-mono text-zinc-300">/shops</span> to see changes.
        </p>
      ) : null}

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="shopIdsJson" value={JSON.stringify(ids)} />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Selected ({ids.length}/{PLATFORM_ALL_PAGE_FEATURED_LIMIT})
          </p>
          {ids.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-600">None — featured order is sales, then views, then name.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {ids.map((id, idx) => (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/90 bg-zinc-900/40 px-3 py-2 text-xs"
                >
                  <span className="min-w-0 text-zinc-200">
                    <span className="tabular-nums text-zinc-500">{idx + 1}. </span>
                    {labelById.get(id) ?? id}
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                      disabled={idx >= ids.length - 1}
                      onClick={() => move(idx, 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-900/50 px-2 py-0.5 text-[11px] text-red-200/90 hover:bg-red-950/30"
                      onClick={() => remove(id)}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Add shop</p>
          {shops.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-600">No creator shops in the database.</p>
          ) : (
            <select
              key={`${ids.join()}`}
              className="mt-2 w-full max-w-md rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
              defaultValue=""
              disabled={ids.length >= PLATFORM_ALL_PAGE_FEATURED_LIMIT || available.length === 0}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                add(v);
              }}
            >
              <option value="">
                {ids.length >= PLATFORM_ALL_PAGE_FEATURED_LIMIT
                  ? "Slot limit reached"
                  : available.length === 0
                    ? "All shops selected"
                    : "Choose shop to add…"}
              </option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} — /{s.slug}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            Save /shops featured picks
          </button>
          <button
            type="button"
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            onClick={() => setIds([])}
          >
            Clear all
          </button>
        </div>
      </form>
    </div>
  );
}
