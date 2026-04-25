"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ItemGuidelinesArticle } from "@/components/ItemGuidelinesArticle";

export function ItemGuidelinesPopup(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Item guidelines"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-zinc-100">Item guidelines</h3>
            <p className="mt-1 text-xs text-zinc-500">Press Escape or click outside to close.</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
          <ItemGuidelinesArticle className="space-y-4 text-sm leading-relaxed text-zinc-300" />

          <p className="mt-4 text-xs text-zinc-600">
            This page is a practical summary, not legal advice. For storefront policies fans see, see also{" "}
            <Link
              href="/shop-regulations"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300"
              onClick={(e) => e.stopPropagation()}
            >
              shop regulations
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

