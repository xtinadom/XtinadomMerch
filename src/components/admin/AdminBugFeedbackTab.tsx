"use client";

import { useMemo, useState } from "react";
import { adminUpdateBugFeedbackReport } from "@/actions/admin-bug-feedback";

export type AdminBugFeedbackRow = {
  id: string;
  shop: { slug: string; displayName: string };
  happened: string;
  expected: string;
  stepsToReproduce: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  imageUrl: string | null;
  createdAtIso: string;
  resolvedAtIso: string | null;
  adminNotes: string | null;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function AdminBugFeedbackTab({ rows }: { rows: AdminBugFeedbackRow[] }) {
  const [showResolved, setShowResolved] = useState(false);
  const filtered = useMemo(
    () => rows.filter((r) => (showResolved ? true : r.resolvedAtIso == null)),
    [rows, showResolved],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Bug/Feedback</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Dashboard bug reports from shop owners (newest first).
          </p>
        </div>
        <label className="flex select-none items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="border-zinc-600 bg-zinc-900 text-sky-600"
          />
          Show resolved
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No reports.</p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{r.shop.displayName}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-600">/s/{r.shop.slug}</p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    <time dateTime={r.createdAtIso}>{formatWhen(r.createdAtIso)}</time>
                    {r.resolvedAtIso ? (
                      <>
                        {" · "}
                        <span className="text-emerald-200/80">Resolved</span>
                      </>
                    ) : (
                      <>
                        {" · "}
                        <span className="text-amber-200/80">Unresolved</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.resolvedAtIso ? (
                    <form action={adminUpdateBugFeedbackReport}>
                      <input type="hidden" name="reportId" value={r.id} />
                      <input type="hidden" name="resolved" value="0" />
                      <button
                        type="submit"
                        className="rounded border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
                      >
                        Mark unresolved
                      </button>
                    </form>
                  ) : (
                    <form action={adminUpdateBugFeedbackReport}>
                      <input type="hidden" name="reportId" value={r.id} />
                      <input type="hidden" name="resolved" value="1" />
                      <button
                        type="submit"
                        className="rounded border border-emerald-900/50 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-200/90 hover:border-emerald-800/70 hover:bg-emerald-950/35"
                      >
                        Mark resolved
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">What happened</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-200">{r.happened}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Expected</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-200">{r.expected}</p>
                </div>
              </div>

              {r.stepsToReproduce ? (
                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Steps</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-300">{r.stepsToReproduce}</p>
                </div>
              ) : null}

              {r.pageUrl ? (
                <div className="mt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Page</p>
                  <a
                    href={r.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all text-xs text-blue-400/90 underline decoration-blue-500/40 underline-offset-2 hover:text-blue-300"
                  >
                    {r.pageUrl}
                  </a>
                </div>
              ) : null}

              {r.imageUrl ? (
                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Screenshot</p>
                  <div className="mt-2 flex flex-wrap items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="h-24 w-24 rounded border border-zinc-700 object-cover"
                    />
                    <a
                      href={r.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs text-blue-400/90 underline decoration-blue-500/40 underline-offset-2 hover:text-blue-300"
                    >
                      {r.imageUrl}
                    </a>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Admin notes</p>
                <form action={adminUpdateBugFeedbackReport} className="mt-2 space-y-2">
                  <input type="hidden" name="reportId" value={r.id} />
                  <textarea
                    name="adminNotes"
                    defaultValue={r.adminNotes ?? ""}
                    rows={3}
                    className="block w-full resize-y rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm leading-snug text-zinc-100"
                    placeholder="Optional internal notes…"
                  />
                  <button
                    type="submit"
                    className="rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    Save notes
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

