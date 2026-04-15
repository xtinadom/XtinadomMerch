"use client";

import type { ReactNode } from "react";

/** Renders notice copy with https URLs as links (same behavior as the notifications tab). */
export function DashboardNoticeBody({ body, className }: { body: string; className?: string }) {
  const parts = body.split(/(https?:\/\/[^\s]+)/g);
  const nodes: ReactNode = parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      let label = part;
      try {
        const u = new URL(part);
        if (u.pathname === "/shop-regulations" || u.pathname.endsWith("/shop-regulations")) {
          label = "Shop regulations";
        }
      } catch {
        /* ignore */
      }
      return (
        <a
          key={i}
          href={part}
          className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
  return <span className={className}>{nodes}</span>;
}
