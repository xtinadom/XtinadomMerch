"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CopyablePrintifyId } from "@/components/admin/CopyablePrintifyId";
import {
  PrintifyCatalogPublishToggleForm,
  PrintifyCatalogResyncForm,
} from "@/components/admin/PrintifyInventoryCatalogActionForms";
import { ADMIN_BACKEND_BASE_PATH } from "@/lib/admin-dashboard-urls";

export type PrintifyCatalogTableRow = {
  printifyId: string;
  title: string;
  updatedAtIso: string | null;
  heroSrc: string | null;
  listingProductId: string | null;
};

type SortKey = "title" | "updated";

function formatListingUpdatedParts(d: Date): { date: string; time: string } {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h24 = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const isAm = h24 < 12;
  const h12 = h24 % 12 || 12;
  const ap = isAm ? "am" : "pm";
  return { date: `${mm}/${dd}`, time: `${h12}:${mins} ${ap}` };
}

function SortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "left" | "center";
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={`p-2 font-medium whitespace-nowrap ${align === "center" ? "text-center" : ""}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex max-w-full items-center gap-1 rounded px-0.5 hover:text-zinc-300 ${align === "center" ? "w-full justify-center" : "text-left"}`}
      >
        <span>{label}</span>
        <span className="shrink-0 text-[10px] font-normal text-zinc-600" aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function PrintifyCatalogSortableTable({ rows }: { rows: PrintifyCatalogTableRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "title",
    dir: "asc",
  });

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      if (sort.key === "title") {
        const c = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        return sort.dir === "asc" ? c : -c;
      }
      const ta = a.updatedAtIso ? new Date(a.updatedAtIso).getTime() : Number.NEGATIVE_INFINITY;
      const tb = b.updatedAtIso ? new Date(b.updatedAtIso).getTime() : Number.NEGATIVE_INFINITY;
      return sort.dir === "asc" ? ta - tb : tb - ta;
    });
    return out;
  }, [rows, sort]);

  function onSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "updated" ? "desc" : "asc" },
    );
  }

  return (
    <div className="mt-4 max-h-[min(420px,50vh)] overflow-auto rounded-lg border border-zinc-800">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 z-[1] bg-zinc-900 text-zinc-500">
          <tr>
            <th className="w-14 p-2 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              Img
            </th>
            <SortTh
              label="Title"
              sortKey="title"
              activeKey={sort.key}
              dir={sort.dir}
              onSort={onSort}
            />
            <SortTh
              label="Updated"
              sortKey="updated"
              activeKey={sort.key}
              dir={sort.dir}
              onSort={onSort}
              align="center"
            />
            <th className="p-2 text-center font-medium whitespace-nowrap">Resync</th>
            <th className="p-2 text-center font-medium whitespace-nowrap">Toggle published</th>
          </tr>
        </thead>
        <tbody className="text-zinc-400">
          {sorted.map((p) => {
            const updatedAtSource = p.updatedAtIso ? new Date(p.updatedAtIso) : null;
            const updatedParts = updatedAtSource ? formatListingUpdatedParts(updatedAtSource) : null;
            const updatedCell =
              updatedParts && updatedAtSource ? (
                <span
                  className="inline-flex flex-col items-center gap-0.5 leading-tight text-zinc-400"
                  title={updatedAtSource.toISOString()}
                >
                  <span>{updatedParts.date}</span>
                  <span>{updatedParts.time}</span>
                </span>
              ) : (
                <span className="text-zinc-600">—</span>
              );

            return (
              <tr key={p.printifyId} className="border-t border-zinc-800/80">
                <td className="p-2 align-middle">
                  {p.heroSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.heroSrc}
                      alt=""
                      className="h-10 w-10 rounded border border-zinc-700 object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded border border-zinc-800 bg-zinc-900/80 text-[10px] text-zinc-600"
                      aria-hidden
                    >
                      —
                    </div>
                  )}
                </td>
                <td className="p-2 align-middle">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-zinc-300">{p.title}</span>
                      {p.listingProductId ? (
                        <Link
                          href={`${ADMIN_BACKEND_BASE_PATH}?tab=printify&listing=${encodeURIComponent(p.listingProductId)}`}
                          title="Admin storefront listing details"
                          className="shrink-0 pt-0.5 text-[10px] font-normal normal-case tracking-normal text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline"
                        >
                          example
                        </Link>
                      ) : null}
                    </div>
                    <CopyablePrintifyId id={p.printifyId} />
                  </div>
                </td>
                <td className="p-2 text-center align-middle">{updatedCell}</td>
                <td className="p-2 text-center align-middle whitespace-nowrap">
                  <PrintifyCatalogResyncForm printifyProductId={p.printifyId} />
                </td>
                <td className="p-2 text-center align-middle whitespace-nowrap">
                  <PrintifyCatalogPublishToggleForm printifyProductId={p.printifyId} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
