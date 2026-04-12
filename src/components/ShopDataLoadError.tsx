import Link from "next/link";

function formatCause(cause: unknown): string {
  if (cause instanceof Error) {
    const extra = cause.cause != null ? `\nCaused by: ${String(cause.cause)}` : "";
    return `${cause.name}: ${cause.message}${extra}`;
  }
  return String(cause);
}

/** Heuristic: Prisma / Postgres when tables or columns were never migrated. */
function likelySchemaNotApplied(cause: unknown): boolean {
  const msg = cause instanceof Error ? cause.message : String(cause);
  return /P2021|P2022|P2010|does not exist|relation\s+"|no such table|undefined table|Unknown table/i.test(
    msg,
  );
}

type Props = { cause?: unknown };

/** Inline fallback when a server component cannot query the database (RSC; not the segment error boundary). */
export function ShopDataLoadError({ cause }: Props) {
  const showDevDetail = process.env.NODE_ENV === "development" && cause != null;
  const suggestMigrate = likelySchemaNotApplied(cause);

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="store-dimension-page-title text-xl text-zinc-100">
        This page couldn&apos;t load
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        The shop could not read product data from Postgres. Builds on Vercel do{" "}
        <span className="text-zinc-300">not</span> apply migrations by default — you must run{" "}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-200">
          prisma migrate deploy
        </code>{" "}
        once against your <span className="text-zinc-300">production</span> database (direct /
        non-pooling URL works best). See{" "}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-blue-300/90">VERCEL.md</code>{" "}
        section <span className="text-zinc-300">2. Database schema</span>, or after{" "}
        <code className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300">
          vercel env pull
        </code>{" "}
        run{" "}
        <code className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300">
          npm run db:migrate:prod
        </code>
        .
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Also confirm{" "}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-200">
          POSTGRES_PRISMA_URL
        </code>{" "}
        or{" "}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-200">DATABASE_URL</code>{" "}
        is set for <span className="text-zinc-300">Production</span> (and Preview if you use it) in
        Vercel, then redeploy. Check{" "}
        <span className="text-zinc-300">Vercel → project → Logs</span> for Prisma or timeout errors.
      </p>
      {suggestMigrate ? (
        <p className="mt-4 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100/90">
          The server error matches a missing table or column. Run migrations against this deployment&apos;s
          database, then reload.
        </p>
      ) : null}
      {showDevDetail ? (
        <pre className="mt-6 max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-left font-mono text-[11px] leading-relaxed text-red-300/90 whitespace-pre-wrap break-words">
          {formatCause(cause)}
        </pre>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="rounded-lg border border-blue-900/50 bg-blue-950/30 px-4 py-2 text-sm text-blue-100 hover:bg-blue-950/50"
        >
          Back to welcome
        </Link>
      </div>
    </main>
  );
}
