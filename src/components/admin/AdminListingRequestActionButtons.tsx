"use client";

import { useFormStatus } from "react-dom";

export function AdminApproveSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded bg-emerald-900/40 px-3 py-1 text-xs text-emerald-200 transition hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? "Approving…" : "Approve"}
    </button>
  );
}

export function AdminFreezeSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded border border-amber-900/50 bg-amber-950/30 px-3 py-1 text-xs text-amber-200/90 transition hover:border-amber-700/50 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? "Freezing…" : "Freeze"}
    </button>
  );
}
