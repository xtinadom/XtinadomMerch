"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { syncPrintifyFromCatalog } from "@/actions/admin";

const LAST_FULL_SYNC_STORAGE_KEY = "xtinadom.printify.lastFullSyncAt";

function isValidIsoTimestamp(iso: string): boolean {
  const t = Date.parse(iso.trim());
  return Number.isFinite(t);
}

function formatFullSyncLocal(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const h24 = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const isAm = h24 < 12;
  const h12 = h24 % 12 || 12;
  const ap = isAm ? "am" : "pm";
  return `${mm}/${dd}/${yyyy} · ${h12}:${mins} ${ap}`;
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90 ${className ?? ""}`}
      aria-hidden
    />
  );
}

function SyncSubmitButton({
  label,
  pendingLabel,
  doneLabel,
  variant,
  showDone,
}: {
  label: string;
  pendingLabel: string;
  doneLabel: string;
  variant: "primary" | "secondary";
  showDone: boolean;
}) {
  const { pending } = useFormStatus();
  const base =
    variant === "primary"
      ? "rounded bg-blue-900/80 px-3 py-1.5 text-xs font-medium text-blue-100 hover:bg-blue-800/80 disabled:opacity-70"
      : "rounded border border-zinc-600 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-70";
  const doneRing =
    showDone && !pending ? " ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-zinc-950" : "";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${base}${doneRing} inline-flex min-h-[2rem] min-w-[5.5rem] items-center justify-center gap-2`}
    >
      {pending ? (
        <>
          <Spinner />
          <span>{pendingLabel}</span>
        </>
      ) : showDone ? (
        <span className="text-emerald-200/95">{doneLabel}</span>
      ) : (
        label
      )}
    </button>
  );
}

type LastOkMode = "new" | "full";

export function PrintifyCatalogSyncButtons({
  lastOkMode,
  fullSyncAtIso,
}: {
  /** Set when URL has `sync=ok&syncMode=…` after redirect */
  lastOkMode?: LastOkMode;
  /** ISO time from server redirect after full sync; persisted in localStorage */
  fullSyncAtIso?: string;
}) {
  const [lastFullSyncIso, setLastFullSyncIso] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (fullSyncAtIso?.trim() && isValidIsoTimestamp(fullSyncAtIso)) {
        const t = fullSyncAtIso.trim();
        localStorage.setItem(LAST_FULL_SYNC_STORAGE_KEY, t);
        setLastFullSyncIso(t);
        return;
      }
      const stored = localStorage.getItem(LAST_FULL_SYNC_STORAGE_KEY);
      if (stored && isValidIsoTimestamp(stored)) setLastFullSyncIso(stored);
    } catch {
      if (fullSyncAtIso?.trim() && isValidIsoTimestamp(fullSyncAtIso)) {
        setLastFullSyncIso(fullSyncAtIso.trim());
      }
    }
  }, [fullSyncAtIso]);

  const lastFullLine =
    lastFullSyncIso && Number.isFinite(new Date(lastFullSyncIso).getTime())
      ? formatFullSyncLocal(lastFullSyncIso)
      : null;

  return (
    <div className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-2">
      <form action={syncPrintifyFromCatalog}>
        <input type="hidden" name="syncMode" value="new" />
        <SyncSubmitButton
          label="Sync new"
          pendingLabel="Syncing…"
          doneLabel="Complete"
          variant="primary"
          showDone={lastOkMode === "new"}
        />
      </form>
      <div className="flex flex-col gap-1">
        <form action={syncPrintifyFromCatalog}>
          <input type="hidden" name="syncMode" value="full" />
          <SyncSubmitButton
            label="Full sync"
            pendingLabel="Full sync…"
            doneLabel="Complete"
            variant="secondary"
            showDone={lastOkMode === "full"}
          />
        </form>
        {lastFullLine ? (
          <p className="max-w-[14rem] text-[10px] leading-snug text-zinc-500">
            Last full sync{" "}
            <time className="text-zinc-400" dateTime={lastFullSyncIso ?? undefined}>
              {lastFullLine}
            </time>
          </p>
        ) : null}
      </div>
    </div>
  );
}
