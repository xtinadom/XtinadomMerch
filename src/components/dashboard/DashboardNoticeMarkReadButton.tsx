"use client";

import { useFormStatus } from "react-dom";

export function DashboardNoticeMarkReadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Marking…" : "Mark as read"}
    </button>
  );
}
