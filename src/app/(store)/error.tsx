"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[store]", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">
        This page couldn&apos;t load
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Something failed on the server while loading the shop. On Vercel this
        usually means{" "}
        <span className="text-zinc-300">
          Postgres env vars are missing or migrations were not applied
        </span>
        . Check the deployment logs and{" "}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-rose-300/90">
          VERCEL.md
        </code>{" "}
        (database URL, then{" "}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
          prisma migrate deploy
        </code>
        ).
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-2 text-sm text-rose-100 hover:bg-rose-950/50"
        >
          Back to welcome
        </Link>
      </div>
    </main>
  );
}
