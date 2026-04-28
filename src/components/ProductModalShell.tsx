"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function ProductModalShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function close() {
    router.back();
  }

  return (
    <div className="store-modal-overlay-scroll fixed inset-0 z-[2500] flex items-start justify-center overflow-y-auto overscroll-contain p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))] sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        aria-label="Close product"
        className="fixed inset-0 bg-black/72 backdrop-blur-lg"
        onClick={close}
      />
      <div
        className="store-dimension-panel store-product-modal-panel animate-store-panel-in relative z-[2501] flex w-full max-h-[min(calc(100dvh-2rem),calc(100svh-2rem))] min-h-0 max-w-3xl flex-col overflow-hidden shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-950/90 text-lg leading-none text-zinc-400 shadow-sm backdrop-blur-sm transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-100 sm:right-3 sm:top-3"
        >
          ×
        </button>
        <div className="store-product-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-10 pr-14 sm:px-10 sm:pb-10 sm:pt-6 sm:pr-16">
          {children}
        </div>
      </div>
    </div>
  );
}
