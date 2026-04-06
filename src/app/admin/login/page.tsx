"use client";

import { useState } from "react";
import Link from "next/link";
import { loginAdmin } from "@/actions/admin";

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">Admin login</h1>
      <form
        className="mt-6 space-y-4"
        action={async (fd) => {
          setError(null);
          setPending(true);
          try {
            const r = await loginAdmin(fd);
            if (r?.error) setError(r.error);
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="block text-sm text-zinc-400">
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-100 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          {pending ? "…" : "Sign in"}
        </button>
      </form>
      <Link href="/" className="mt-8 inline-block text-xs text-zinc-600 hover:underline">
        ← Home
      </Link>
    </div>
  );
}
