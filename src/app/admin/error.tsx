"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin route]", error);
  }, [error]);

  const msg = error.message ?? String(error);
  /** Query uses a field the loaded Prisma Client was not generated with (stale `.next` / dev server / singleton). */
  const looksLikeStaleClient =
    /Unknown argument `/i.test(msg) ||
    /Cannot read properties of undefined \(reading 'count'\)/i.test(msg);
  /** Postgres or migrations behind (missing column/table). */
  const looksLikeDb =
    !looksLikeStaleClient &&
    (/does not exist|Unknown column|P20\d{2}/i.test(msg) ||
      (/invalid.*prisma.*invocation/i.test(msg) && /column|relation|migrate/i.test(msg)));

  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/25 px-4 py-6 text-sm text-red-100/90">
      <h2 className="text-base font-semibold text-red-50">Admin failed to load</h2>
      <p className="mt-2 text-red-200/80">
        {looksLikeStaleClient
          ? "The running app is using an outdated Prisma Client (Turbopack cache, a long-lived dev process, or a cached `globalThis` Prisma singleton). The schema or generated client on disk is newer than what this Node process loaded (for example a new model delegate or field like `creatorRemovedFromShopAt`)."
          : looksLikeDb
            ? "The database does not match the current Prisma schema (for example a missing column from migration `20260415160000_shop_listing_creator_removed`). Apply pending migrations to that database, then reload."
            : "Something went wrong while loading this page. Check the server log for the stack trace."}
      </p>
      {looksLikeStaleClient ? (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs text-red-200/75">
          <li>
            From the repo root:{" "}
            <code className="rounded bg-zinc-950/80 px-1 py-0.5 font-mono text-[11px] text-zinc-300">
              npx prisma generate
            </code>
          </li>
          <li>
            Stop the dev server, delete the{" "}
            <code className="rounded bg-zinc-950/80 px-1 py-0.5 font-mono text-[11px] text-zinc-300">.next</code>{" "}
            folder, then start <code className="font-mono text-[11px]">npm run dev</code> again.
          </li>
        </ol>
      ) : null}
      {looksLikeDb ? (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs text-red-200/75">
          <li>
            <strong className="font-medium text-red-100/90">Local or any URL in DATABASE_URL:</strong> from the repo
            root run{" "}
            <code className="rounded bg-zinc-950/80 px-1 py-0.5 font-mono text-[11px] text-zinc-300">
              npx prisma migrate deploy
            </code>{" "}
            (same machine/env where that variable points at your Postgres).
          </li>
          <li>
            <strong className="font-medium text-red-100/90">Production Neon (this project):</strong>{" "}
            <code className="rounded bg-zinc-950/80 px-1 py-0.5 font-mono text-[11px] text-zinc-300">
              npx vercel env pull .env.production.local --environment production
            </code>{" "}
            then{" "}
            <code className="rounded bg-zinc-950/80 px-1 py-0.5 font-mono text-[11px] text-zinc-300">
              npm run db:migrate:prod
            </code>{" "}
            (uses a direct / non-pooling URL; see <code className="font-mono text-[11px]">scripts/migrate-production.cjs</code>
            ).
          </li>
        </ol>
      ) : null}
      <pre className="mt-4 max-h-48 overflow-auto rounded border border-red-900/40 bg-zinc-950/80 p-3 font-mono text-[11px] text-zinc-300">
        {msg}
      </pre>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-red-800/60 px-3 py-1.5 text-xs text-red-100 hover:bg-red-950/50"
        >
          Try again
        </button>
        <Link
          href="/admin/login"
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Admin login
        </Link>
      </div>
    </div>
  );
}
