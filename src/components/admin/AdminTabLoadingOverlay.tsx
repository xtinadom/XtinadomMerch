"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const STUCK_OVERLAY_MS = 45_000;

function adminLocationFromAnchor(a: HTMLAnchorElement): string | null {
  const href = a.getAttribute("href");
  if (!href) return null;
  try {
    const url = new URL(href, window.location.origin);
    if (url.pathname !== "/admin") return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function isModifiedClick(e: MouseEvent | PointerEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

/**
 * Shows a lightweight modal while soft-navigating between `/admin?…` URLs (tab switches, support thread, etc.).
 * Clears after the next admin URL is committed and the browser has had a frame to paint the overlay.
 */
export function AdminTabLoadingOverlay() {
  const searchParams = useSearchParams();
  const spKey = searchParams.toString();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedUrlRef = useRef("");

  const disarmOverlayRef = useRef(() => {
    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    }
    pendingRef.current = false;
    setPending(false);
  });

  useEffect(() => {
    lastCommittedUrlRef.current = `${window.location.pathname}${window.location.search}`;
  }, [spKey]);

  useLayoutEffect(() => {
    if (!pendingRef.current) return;
    const id = requestAnimationFrame(() => {
      disarmOverlayRef.current();
    });
    return () => cancelAnimationFrame(id);
  }, [spKey]);

  useEffect(() => {
    const armOverlay = () => {
      if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = setTimeout(() => {
        stuckTimerRef.current = null;
        disarmOverlayRef.current();
      }, STUCK_OVERLAY_MS);
      pendingRef.current = true;
      setPending(true);
    };

    const maybeArmFromAnchorEvent = (e: PointerEvent | MouseEvent) => {
      if (isModifiedClick(e)) return;
      if (e.type === "pointerdown") {
        const pe = e as PointerEvent;
        if (pe.pointerType === "mouse" && pe.button !== 0) return;
      } else if (e.type === "click" && (e as MouseEvent).button !== 0) return;

      const el = e.target as HTMLElement | null;
      const a = el?.closest("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const next = adminLocationFromAnchor(a);
      if (!next) return;
      const cur = `${window.location.pathname}${window.location.search}`;
      if (next === cur) return;
      armOverlay();
    };

    document.addEventListener("pointerdown", maybeArmFromAnchorEvent, true);
    document.addEventListener("click", maybeArmFromAnchorEvent, true);

    const onPopState = () => {
      if (window.location.pathname !== "/admin") return;
      const next = `${window.location.pathname}${window.location.search}`;
      if (next === lastCommittedUrlRef.current) return;
      armOverlay();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("pointerdown", maybeArmFromAnchorEvent, true);
      document.removeEventListener("click", maybeArmFromAnchorEvent, true);
      window.removeEventListener("popstate", onPopState);
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
        stuckTimerRef.current = null;
      }
    };
  }, []);

  if (!pending) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[9998] flex items-center justify-center bg-zinc-950/80 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="max-w-sm rounded-xl border border-zinc-700 bg-zinc-900/95 px-6 py-4 text-center shadow-xl ring-1 ring-black/40">
        <p className="text-sm font-medium text-zinc-100">Loading tab…</p>
        <p className="mt-1 text-xs text-zinc-500">Fetching this admin section.</p>
      </div>
    </div>
  );
}
