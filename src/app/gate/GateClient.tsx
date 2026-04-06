"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

function safeRedirectPath(from: string | null): string {
  if (!from || !from.startsWith("/") || from.startsWith("//")) {
    return "/";
  }
  return from;
}

export function GateClient() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/site-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not sign in");
        return;
      }
      const target = safeRedirectPath(searchParams.get("from"));
      // Full navigation so the browser reliably applies Set-Cookie before the next request.
      // Client router transitions can race the httpOnly gate cookie and bounce back to /gate.
      window.location.assign(target);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-rose-400/80">
          Xtinadom
        </p>
        <h1 className="mt-3 text-center text-xl font-semibold text-zinc-100">
          Enter password
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          This shop is private. Ask the site owner for access.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm text-zinc-400">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none ring-rose-500/30 focus:border-rose-600 focus:ring-2"
            />
          </label>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-rose-700 py-2.5 text-sm font-medium text-white transition hover:bg-rose-600 disabled:opacity-50"
          >
            {pending ? "Checking…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
