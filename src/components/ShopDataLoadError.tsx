import Link from "next/link";

/** Inline fallback when a server component cannot query the database (RSC; not the segment error boundary). */
export function ShopDataLoadError() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="store-dimension-page-title text-xl text-zinc-100">
        This page couldn&apos;t load
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Something failed on the server while loading the shop. On Vercel this usually means Postgres
        env vars are missing, the database is unreachable, or migrations were not applied. Check the
        deployment logs and{" "}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-blue-300/90">VERCEL.md</code>
        .
      </p>
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
