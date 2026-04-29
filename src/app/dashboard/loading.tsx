/** Dashboard trees do heavy server work; show shell while the page RSC runs. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-[996px] flex-col items-center justify-center gap-4 px-4 py-16 text-zinc-400">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500/90"
        aria-hidden
      />
      <p className="text-center text-sm text-zinc-500">Loading dashboard…</p>
    </div>
  );
}
