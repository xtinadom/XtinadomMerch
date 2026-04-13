"use client";

import { useState } from "react";
import Link from "next/link";
import { requestShopPasswordReset } from "@/actions/shop-password-reset";

const SUCCESS_FALLBACK =
  "If an account exists with that email, a reset link will be sent. Check your inbox and spam folder.";

export default function DashboardForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-50">Reset dashboard password</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Enter the email you used when you created your shop. We will send a one-time link if that
        account exists.
      </p>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setMessage(null);
          setPending(true);
          try {
            const fd = new FormData(e.currentTarget);
            const r = await requestShopPasswordReset(undefined, fd);
            if (r && typeof r === "object" && r.ok === true) {
              setMessage(
                typeof r.message === "string" && r.message.trim() ? r.message : SUCCESS_FALLBACK,
              );
            } else if (r && typeof r === "object" && r.ok === false && typeof r.error === "string") {
              setError(r.error);
            } else {
              console.error("[forgot-password] unexpected action return:", r);
              setError(
                "Unexpected response from the server. Open the browser console (F12) and check Vercel logs for [shop-password-reset].",
              );
            }
          } catch (err) {
            console.error("[forgot-password] action threw:", err);
            const msg = err instanceof Error ? err.message : String(err);
            setError(
              msg
                ? `Request failed: ${msg.slice(0, 400)}`
                : "Something went wrong. Check the browser console and Vercel logs.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="block text-sm text-zinc-400">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-100 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <div className="mt-4 min-h-[3.5rem]" aria-live="polite" aria-atomic="true">
        {error ? (
          <p
            className="rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-3 text-sm text-amber-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {message ? (
          <p
            className="rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-3 text-sm leading-relaxed text-zinc-100"
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        <Link href="/dashboard/login" className="text-blue-400 hover:underline">
          Back to sign in
        </Link>
      </p>
      <Link href="/" className="mt-6 text-center text-xs text-zinc-600 hover:underline">
        ← Home
      </Link>
    </main>
  );
}
