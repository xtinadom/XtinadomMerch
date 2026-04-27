"use client";

import { useActionState } from "react";
import { adminClearPlatformSalesHistoryAction } from "@/actions/admin-platform-sales";

type ClearState = { ok: boolean; error?: string } | null;

export function AdminClearPlatformSalesForm(props: {
  /** Show full destructive UI (hidden in production when action would reject). */
  enabled: boolean;
}) {
  const { enabled } = props;
  const [state, formAction, pending] = useActionState(
    async (_prev: ClearState, formData: FormData): Promise<ClearState> =>
      adminClearPlatformSalesHistoryAction(formData),
    null,
  );

  if (!enabled) {
    return (
      <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-zinc-600">
        Clearing orders is blocked in production unless{" "}
        <span className="font-mono text-zinc-500">ALLOW_ADMIN_CLEAR_SALES_HISTORY=true</span>.
      </p>
    );
  }

  return (
    <details className="mt-6 rounded-lg border border-red-900/40 bg-red-950/15 px-3 py-2">
      <summary className="cursor-pointer select-none text-[11px] font-medium text-red-200/90">
        Clear sales history (destructive)
      </summary>
      <form action={formAction} className="mt-3 space-y-3 text-xs">
        <p className="leading-relaxed text-zinc-500">
          Deletes <span className="font-medium text-zinc-400">all orders</span> (and cascaded lines / fulfillment
          jobs). Stripe idempotency rows are not cleared — see ops notes. This cannot be undone.
        </p>
        <label className="flex cursor-pointer items-start gap-2 text-zinc-400">
          <input
            type="checkbox"
            name="resetListingPublicationFees"
            value="true"
            className="mt-1 border-zinc-600 bg-zinc-900"
          />
          <span>
            Also reset publication-fee timestamps on every shop listing (clears synthetic listing-fee rows from this
            report).
          </span>
        </label>
        <label className="block text-zinc-500">
          Type DELETE SALES to confirm
          <input
            name="confirmPhrase"
            type="text"
            autoComplete="off"
            placeholder="DELETE SALES"
            className="mt-1 block w-full max-w-xs rounded border border-red-900/40 bg-zinc-950 px-2 py-1 font-mono text-zinc-200"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-950/60 px-3 py-1.5 font-medium text-red-200 hover:bg-red-950/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Clearing…" : "Clear sales data"}
        </button>
        {state?.ok ? (
          <p className="text-emerald-400/95" role="status">
            Cleared.
          </p>
        ) : null}
        {state?.error ? (
          <p className="text-red-300/95" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
    </details>
  );
}
