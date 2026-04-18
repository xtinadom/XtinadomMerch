"use client";

import { useActionState, useState, useTransition } from "react";
import {
  dashboardCancelAccountDeletionRequest,
  dashboardCompleteAccountDeletionFormState,
  dashboardPauseShop,
  dashboardRequestAccountDeletion,
  dashboardUnpauseShop,
  type AccountDeletionFormState,
} from "@/actions/dashboard-account-danger";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

const initialDeleteState: AccountDeletionFormState = { error: null };

export function ShopDangerZonePanel(props: {
  shopSlug: string;
  shopActive: boolean;
  ownerPausedShopAt: string | null;
  accountDeletionRequestedAt: string | null;
  accountDeletionEmailConfirmedAt: string | null;
  stripeConnectAccountId: string | null;
  stripeConnectBalance: { availableCents: number; pendingCents: number } | null;
}) {
  const {
    shopSlug,
    shopActive,
    ownerPausedShopAt,
    accountDeletionRequestedAt,
    accountDeletionEmailConfirmedAt,
    stripeConnectAccountId,
    stripeConnectBalance,
  } = props;

  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [deleteState, deleteAction] = useActionState(
    dashboardCompleteAccountDeletionFormState,
    initialDeleteState,
  );

  const deletionPending = Boolean(accountDeletionRequestedAt);
  const emailConfirmed = Boolean(accountDeletionEmailConfirmedAt);
  const manuallyPaused = Boolean(ownerPausedShopAt);

  const balanceBlocks =
    Boolean(stripeConnectAccountId) &&
    (stripeConnectBalance == null ||
      stripeConnectBalance.availableCents !== 0 ||
      stripeConnectBalance.pendingCents !== 0);

  const run = async (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) setMsg({ tone: "ok", text: r.message ?? "Saved." });
      else setMsg({ tone: "err", text: r.error ?? "Something went wrong." });
    });
  };

  return (
    <section
      className="scroll-mt-4 rounded-lg border border-red-900/40 bg-red-950/15 p-4 sm:p-5"
      aria-labelledby="shop-danger-heading"
    >
      <h3 id="shop-danger-heading" className="text-sm font-semibold tracking-wide text-red-200/95">
        Shop visibility &amp; account
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        Pause hides your shop from browse and your storefront (<span className="font-mono text-zinc-500">/s/{shopSlug}</span>
        ). Account deletion is a request: your shop freezes immediately, you confirm by email, and we remove the account
        only when your Stripe Connect balance is zero (no pending or available payout funds).
      </p>

      {msg ? (
        <p
          className={`mt-3 text-xs ${msg.tone === "ok" ? "text-emerald-300/90" : "text-amber-200/90"}`}
          role="status"
        >
          {msg.text}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!deletionPending ? (
          <>
            {!shopActive && manuallyPaused ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(dashboardUnpauseShop)}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
              >
                {pending ? "…" : "Unpause shop"}
              </button>
            ) : shopActive ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(dashboardPauseShop)}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
              >
                {pending ? "…" : "Pause shop"}
              </button>
            ) : (
              <p className="text-xs text-zinc-500">
                Your shop is hidden. Use <strong className="text-zinc-400">Unpause</strong> after you cancel any
                deletion request below.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-amber-200/85">
            Shop is frozen for account deletion. Cancel the request below to restore access (unless you had paused the
            shop separately before requesting deletion).
          </p>
        )}
      </div>

      <div className="mt-6 border-t border-red-900/30 pt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-red-300/90">Request account deletion</h4>
        {!deletionPending ? (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-zinc-500">
              We will email you a confirmation link. Until you confirm, you can still use the dashboard. After
              confirmation, you can permanently delete once Stripe shows no funds owed to you.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(dashboardRequestAccountDeletion)}
              className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs font-medium text-red-100 hover:bg-red-950/60 disabled:opacity-50"
            >
              {pending ? "…" : "Request account deletion (freeze shop + email)"}
            </button>
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-xs text-zinc-500">
              {emailConfirmed
                ? "Email confirmed. When Stripe balance is zero, enter your password below to permanently delete."
                : "Check your inbox for the confirmation link (expires in 24 hours)."}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(dashboardCancelAccountDeletionRequest)}
              className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
            >
              {pending ? "…" : "Cancel deletion request"}
            </button>

            {emailConfirmed ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Stripe balance (USD)</p>
                {stripeConnectAccountId ? (
                  stripeConnectBalance == null ? (
                    <p className="mt-1 text-xs text-amber-200/85">
                      Could not load balance from Stripe. Try again later before deleting.
                    </p>
                  ) : (
                    <ul className="mt-1 list-inside list-disc text-xs text-zinc-400">
                      <li>Available: {formatUsd(stripeConnectBalance.availableCents)}</li>
                      <li>Pending: {formatUsd(stripeConnectBalance.pendingCents)}</li>
                    </ul>
                  )
                ) : (
                  <p className="mt-1 text-xs text-zinc-500">No Stripe Connect account — nothing to settle.</p>
                )}

                {balanceBlocks ? (
                  <p className="mt-2 text-xs text-amber-200/90">
                    Withdraw or wait for payouts until both available and pending are $0.00, then try again.
                  </p>
                ) : (
                  <form action={deleteAction} className="mt-3 space-y-2">
                    <label className="block text-xs text-zinc-500">
                      Account password
                      <input
                        type="password"
                        name="password"
                        required
                        autoComplete="current-password"
                        className="mt-1 w-full max-w-xs rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
                      />
                    </label>
                    {deleteState.error ? (
                      <p className="text-xs text-amber-200/90" role="alert">
                        {deleteState.error}
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      className="rounded-lg bg-red-900/50 px-3 py-2 text-xs font-semibold text-red-100 ring-1 ring-red-800/60 hover:bg-red-900/70"
                    >
                      Permanently delete account
                    </button>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
