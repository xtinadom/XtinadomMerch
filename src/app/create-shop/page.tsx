"use client";

import { useState } from "react";
import Link from "next/link";
import { createShopFromSignup } from "@/actions/shop-auth";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function CreateShopPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Create Shop</h1>

      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setPending(true);
          try {
            const fd = new FormData(e.currentTarget);
            const r = await createShopFromSignup(undefined, fd);
            if (r?.error) setError(r.error);
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="block text-sm text-zinc-400">
          Username (shop URL)
          <input
            name="username"
            required
            maxLength={80}
            autoComplete="username"
            placeholder="letters, numbers, hyphens"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
          />
        </label>
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
        <label className="block text-sm text-zinc-400">
          Password
          <input
            type="password"
            name="password"
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
          className="w-full rounded-lg bg-zinc-100 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create Shop"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Already have a shop?{" "}
        <Link href="/dashboard/login" className="text-blue-400 hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center">
        <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-400">
          ← Home
        </Link>
      </p>

      <SiteLegalFooter />
    </main>
  );
}
