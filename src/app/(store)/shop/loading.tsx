export default function ShopLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading shop">
      <div className="h-8 w-48 rounded bg-zinc-800" />
      <div className="space-y-4">
        <div className="h-5 w-32 rounded bg-zinc-800" />
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 w-[175px] rounded-md bg-zinc-800/80" />
          ))}
        </div>
      </div>
    </div>
  );
}
