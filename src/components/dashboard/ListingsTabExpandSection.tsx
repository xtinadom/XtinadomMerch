"use client";

import type { ReactNode } from "react";

/** Collapsible block on the Listings tab (closed by default). */
export function ListingsTabExpandSection({
  className = "",
  title,
  titleClassName,
  blurb,
  badgeCount,
  children,
}: {
  className?: string;
  title: string;
  titleClassName: string;
  blurb?: ReactNode;
  badgeCount?: number;
  children: ReactNode;
}) {
  return (
    <details className={`group rounded-xl border border-zinc-800 bg-zinc-950/25 ${className}`}>
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-xs font-semibold uppercase tracking-wide ${titleClassName}`}>{title}</h3>
            {badgeCount !== undefined ? (
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-200">
                {badgeCount}
              </span>
            ) : null}
          </div>
          {blurb ? <div className="mt-1 text-[11px] text-zinc-600">{blurb}</div> : null}
        </div>
        <span
          className="shrink-0 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600"
          aria-hidden
        >
          Expand
          <span className="ml-1 inline-block transition group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="border-t border-zinc-800/80 px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
