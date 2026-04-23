"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  dashboardDevConfirmAccountDeletionEmail,
  dashboardRequestAccountDeletion,
} from "@/actions/dashboard-account-danger";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function ShopDangerZonePanel(props: {
  accountDeletionRequestedAt: string | null;
  accountDeletionEmailConfirmedAt: string | null;
  stripeConnectAccountId: string | null;
  stripeConnectBalance: { availableCents: number; pendingCents: number } | null;
}) {
  const {
    accountDeletionRequestedAt,
    accountDeletionEmailConfirmedAt,
    stripeConnectAccountId,
    stripeConnectBalance,
  } = props;

  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const deletionPending = Boolean(accountDeletionRequestedAt);
  const emailConfirmed = Boolean(accountDeletionEmailConfirmedAt);

  const balanceBlocks =
    Boolean(stripeConnectAccountId) &&
    (stripeConnectBalance == null ||
      stripeConnectBalance.availableCents !== 0 ||
      stripeConnectBalance.pendingCents !== 0);

  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) => {
    setMsg(null);
    setBusy(true);
    void (async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setMsg({ tone: "ok", text: r.message ?? "Saved." });
          router.refresh();
        } else setMsg({ tone: "err", text: r.error ?? "Something went wrong." });
      } catch (e) {
        console.error("[ShopDangerZonePanel]", e);
        const detail =
          process.env.NODE_ENV === "development" && e instanceof Error && e.message
            ? ` ${e.message}`
            : "";
        setMsg({
          tone: "err",
          text: `Something went wrong. Try again.${detail}`,
        });
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <section
      className="scroll-mt-4 rounded-lg border border-red-900/40 bg-red-950/15 p-4 sm:p-5"
      aria-labelledby="shop-danger-heading"
    >
      <h3 id="shop-danger-heading" className="text-xs font-semibold uppercase tracking-wide text-red-300/90">
        Request account deletion
      </h3>

      {msg ? (
        <p
          className={`mt-3 text-xs ${msg.tone === "ok" ? "text-amber-200/90" : "text-amber-300/90"}`}
          role="status"
        >
          {msg.text}
        </p>
      ) : null}

      {deletionPending ? (
        <p className={`text-xs text-amber-200/85 ${msg ? "mt-3" : "mt-4"}`}>
          {emailConfirmed
            ? "Your confirmation link was used: listing images and profile photos are cleared from our storage, and listings are taken down. When your Stripe balance is zero, opening the dashboard again removes the account automatically."
            : "Your shop is hidden from browse. Open the link in your confirmation email — that step removes your stored photos and listing media, then you can close the account when payouts are settled."}
        </p>
      ) : null}

      <div className={msg || deletionPending ? "mt-6" : "mt-4"}>
        {!deletionPending ? (
          <>
            <p className="mt-2 text-xs text-zinc-500">
              After verifying via the email link and having a zero Stripe balance, your account will be deleted. This cannot be undone!
            </p>
            <div className="mt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(dashboardRequestAccountDeletion)}
                className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs font-medium text-red-100 hover:bg-red-950/60 disabled:opacity-50"
              >
                {busy ? "…" : "Goodbye"}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-xs text-zinc-500">
              {emailConfirmed
                ? "Email confirmed. Withdraw or wait until Stripe shows $0.00 available and pending; the next dashboard load then signs you out and removes the shop."
                : "Check your inbox for the confirmation link (expires in 24 hours)."}
            </p>

            {process.env.NODE_ENV === "development" && deletionPending && !emailConfirmed ? (
              <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-200/90">
                  Local dev only
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  If email links do not work on localhost, use this to mark the deletion email confirmed (same DB +
                  storage cleanup as the real link).
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(dashboardDevConfirmAccountDeletionEmail)}
                  className="mt-2 rounded border border-amber-700/60 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-950/40 disabled:opacity-50"
                >
                  {busy ? "…" : "Dev: confirm deletion email"}
                </button>
              </div>
            ) : null}

            {emailConfirmed ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Stripe balance (USD)</p>
                {stripeConnectAccountId ? (
                  stripeConnectBalance == null ? (
                    <p className="mt-1 text-xs text-amber-200/85">
                      Could not load balance from Stripe. Reload the dashboard later; we need a successful balance read
                      before the account can close.
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
                    Withdraw or wait for payouts until both available and pending are $0.00. The next dashboard visit
                    after that removes the account.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-zinc-400">
                    Balance is clear. If this page does not redirect and sign you out within a moment, reload once.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
