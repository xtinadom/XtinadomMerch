"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { resetShopPasswordWithToken } from "@/actions/shop-password-reset";
import { SHOP_PASSWORD_RESET_PREVIEW_DEMO_TOKEN } from "@/lib/shop-password-reset-email-html";

function isNextRedirectError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const d = "digest" in e ? String((e as { digest?: unknown }).digest) : "";
  return d.startsWith("NEXT_REDIRECT");
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isDevPreviewToken =
    process.env.NODE_ENV === "development" && token === SHOP_PASSWORD_RESET_PREVIEW_DEMO_TOKEN;

  if (!token) {
    return (
      <div className="mt-8 rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-4 text-sm text-amber-100">
        <p className="font-medium text-amber-200">Link incomplete</p>
        <p className="mt-2 leading-relaxed text-amber-100/90">
          Open the password reset link from your email — it includes a long token in the address.
        </p>
        <p className="mt-4">
          <Link href="/dashboard/forgot-password" className="text-blue-400 underline hover:text-blue-300">
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  if (isDevPreviewToken) {
    return (
      <div className="mt-8 space-y-4">
        <div className="rounded-lg border border-zinc-600 bg-zinc-900/60 px-4 py-4 text-sm leading-relaxed text-zinc-300">
          <p className="font-medium text-zinc-100">Email layout preview</p>
          <p className="mt-2">
            This URL is only for checking how the reset email looks. It does not change your password.
          </p>
          <p className="mt-2">
            To reset for real, use{" "}
            <Link href="/dashboard/forgot-password" className="text-blue-400 underline hover:text-blue-300">
              Forgot password
            </Link>{" "}
            and the link from your inbox.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-700 bg-zinc-950/50 p-4 opacity-70">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Sample form (disabled)</p>
          <div className="mt-4 space-y-3">
            <div>
              <span className="text-sm text-zinc-500">New password</span>
              <div className="mt-1 h-10 rounded-lg border border-zinc-700 bg-zinc-900" />
            </div>
            <div>
              <span className="text-sm text-zinc-500">Confirm password</span>
              <div className="mt-1 h-10 rounded-lg border border-zinc-700 bg-zinc-900" />
            </div>
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg bg-zinc-700 py-2 text-sm font-medium text-zinc-400"
            >
              Save password and sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
        Choose a strong password for your shop dashboard. After you save, you will be signed in
        automatically.
      </p>
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
          } catch (err) {
            if (isNextRedirectError(err)) return;
            const msg = err instanceof Error ? err.message : "Something went wrong.";
            setError(msg);
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
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none ring-blue-500/20 focus:border-blue-600 focus:ring-2"
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
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none ring-blue-500/20 focus:border-blue-600 focus:ring-2"
          />
        </label>
        {error ? (
          <p className="rounded-lg border border-amber-900/40 bg-amber-950/25 px-3 py-3 text-sm text-amber-100" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-100 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save password and sign in"}
        </button>
      </form>
    </>
  );
}

export default function DashboardResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16 sm:px-6">
      <p className="store-dimension-brand text-center text-xs uppercase tracking-[0.2em] text-blue-400/80">
        XTINADOM
      </p>
      <h1 className="mt-4 text-center text-xl font-semibold text-zinc-50 sm:text-2xl">
        Set a new password
      </h1>
      <Suspense
        fallback={
          <p className="mt-10 text-center text-sm text-zinc-500" aria-busy="true">
            Loading…
          </p>
        }
      >
        <ResetPasswordContent />
      </Suspense>
      <div className="mt-10 flex flex-col gap-3 border-t border-zinc-800/80 pt-8 text-center text-sm text-zinc-500">
        <Link href="/dashboard/forgot-password" className="text-blue-400 hover:underline">
          Request a new link
        </Link>
        <Link href="/dashboard/login" className="text-zinc-400 hover:text-zinc-200">
          Back to sign in
        </Link>
        <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400">
          ← Home
        </Link>
      </div>
    </main>
  );
}
