import Link from "next/link";

export type ShopBrowseGridShop = {
  id: string;
  slug: string;
  displayName: string;
  profileImageUrl: string | null;
  bio: string | null;
};

/** Same wrap layout as `ShopPlatformBrowseGrid`, but creator shop storefront links. */
export function ShopBrowseGrid({ shops }: { shops: ShopBrowseGridShop[] }) {
  if (shops.length === 0) {
    return <p className="mt-8 text-sm text-zinc-600">No shops yet.</p>;
  }
  return (
    <ul className="mx-auto flex max-w-full flex-wrap justify-center gap-3">
      {shops.map((s) => (
        <li key={s.id} className="w-[175px] shrink-0">
          <Link
            href={`/s/${encodeURIComponent(s.slug)}`}
            className="group block w-full max-w-[175px] rounded-md border border-zinc-800 bg-zinc-900/50 p-1.5 transition hover:border-zinc-600 hover:bg-zinc-900"
          >
            <div className="aspect-square w-full overflow-hidden rounded bg-zinc-800/80">
              {s.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.profileImageUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-zinc-600">
                  {s.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-center text-[11px] font-medium leading-snug text-zinc-200 group-hover:text-blue-200/90">
              {s.displayName}
            </p>
            <p className="mt-0.5 truncate text-center font-mono text-[9px] text-zinc-500">/{s.slug}</p>
            {s.bio ? (
              <p className="mt-1 line-clamp-2 text-center text-[9px] leading-snug text-zinc-500">{s.bio}</p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
