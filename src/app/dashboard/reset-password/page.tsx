"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { resetShopPasswordWithToken } from "@/actions/shop-password-reset";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <p className="text-sm text-amber-400">
        This page needs a valid link from your reset email.{" "}
        <Link href="/dashboard/forgot-password" className="text-blue-400 underline">
          Request a new link
        </Link>
        .
      </p>
    );
  }

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          const fd = new FormData(e.currentTarget);
          const r = await resetShopPasswordWithToken(undefined, fd);
          if (r && !r.ok) setError(r.error);
        } finally {
          setPending(false);
        }
      }}
    >
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm text-zinc-400">
        New password
        <input
          type="password"
          name="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
        />
      </label>
      <label className="block text-sm text-zinc-400">
        Confirm password
        <input
          type="password"
          name="passwordConfirm"
          required
          minLength={10}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
        />
      </label>
      {error ? (
        <p className="text-sm text-amber-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-100 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
      >
        {pending ? "…" : "Save password and sign in"}
      </button>
    </form>
  );
}

export default function DashboardResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-50">Choose a new password</h1>
      <p className="mt-2 text-sm text-zinc-500">Use at least 10 characters.</p>
      <Suspense
        fallback={<p className="mt-8 text-sm text-zinc-500" aria-busy="true">Loading…</p>}
      >
        <ResetPasswordForm />
      </Suspense>
      <p className="mt-8 text-center text-sm text-zinc-500">
        <Link href="/dashboard/login" className="text-blue-400 hover:underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
