"use client";

import type { ReactNode } from "react";

/** Inline `[here](url)` so only “here” is linked (e.g. listing rejection regulations line). */
export function DashboardNoticeBody({ body, className }: { body: string; className?: string }) {
  let keyCounter = 0;
  const nextKey = () => `notice-${keyCounter++}`;

  const linkifyPlainUrls = (text: string): ReactNode[] => {
    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part) => {
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
            key={nextKey()}
            href={part}
            className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
        );
      }
      return <span key={nextKey()}>{part}</span>;
    });
  };

  const linkifyHereMarkdown = (text: string): ReactNode[] => {
    const out: ReactNode[] = [];
    let last = 0;
    const re = /\[here\]\((https?:\/\/[^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push(...linkifyPlainUrls(text.slice(last, m.index)));
      out.push(
        <a
          key={nextKey()}
          href={m[1]}
          className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          here
        </a>,
      );
      last = m.index + m[0].length;
    }
    out.push(...linkifyPlainUrls(text.slice(last)));
    return out;
  };

  const rootClass = [className, "whitespace-pre-line"].filter(Boolean).join(" ");
  return <span className={rootClass}>{linkifyHereMarkdown(body)}</span>;
}
