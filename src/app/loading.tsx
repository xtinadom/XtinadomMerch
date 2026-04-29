/** Route-level fallback while RSC compiles / resolves (dev Webpack can take 10–20s on first hit). */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-zinc-400">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500/90"
        aria-hidden
      />
      <p className="text-center text-sm text-zinc-500">Loading…</p>
    </div>
  );
}
