"use client";

import { useState } from "react";
import Link from "next/link";
import { requestShopPasswordReset } from "@/actions/shop-password-reset";

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
            if (r?.ok === true && r.message) {
              setMessage(r.message);
            } else if (r && r.ok === false) {
              setError(r.error);
            } else {
              setError("Something went wrong. Please try again.");
            }
          } catch {
            setError("Something went wrong. Please try again.");
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
