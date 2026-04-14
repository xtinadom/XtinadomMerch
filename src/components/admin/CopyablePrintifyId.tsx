"use client";

import { useCallback, useState } from "react";

/** Printify catalog product id — click copies to clipboard. */
export function CopyablePrintifyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(() => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(id);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        try {
          const ta = document.createElement("textarea");
          ta.value = id;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          /* ignore */
        }
      }
    })();
  }, [id]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group mt-1 w-full max-w-full rounded border border-transparent px-0 py-0.5 text-left transition hover:border-zinc-700/80 hover:bg-zinc-900/40"
      title="Copy Printify product ID"
    >
      <span className="block w-full break-all font-mono text-[10px] leading-snug text-zinc-500 group-hover:text-zinc-300">
        {id}
      </span>
      <span className="block text-[9px] text-zinc-600 group-hover:text-zinc-500">
        {copied ? "Copied to clipboard" : "Click to copy"}
      </span>
    </button>
  );
}
