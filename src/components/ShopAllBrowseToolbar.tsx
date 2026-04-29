import Link from "next/link";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

type TagRow = { slug: string; name: string };

export type ShopAllBrowseSortParam = "price" | "popular" | "new";

function shopAllQueryString(opts: {
  q?: string | null;
  tag?: string | null;
  flat?: boolean;
  sort?: ShopAllBrowseSortParam | null;
}) {
  const p = new URLSearchParams();
  if (opts.q?.trim()) p.set("q", opts.q.trim());
  if (opts.tag?.trim()) p.set("tag", opts.tag.trim());
  if (opts.flat) p.set("flat", "1");
  if (opts.sort && opts.sort !== "price") p.set("sort", opts.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function shopAllPath(shopSlug: string) {
  return shopSlug === PLATFORM_SHOP_SLUG
    ? "/shop/all"
    : `/s/${encodeURIComponent(shopSlug)}/all`;
}

export function ShopAllBrowseToolbar({
  shopSlug,
  tags,
  selectedTagSlug,
  selectedSort,
  searchQuery,
  browseFlat,
}: {
  shopSlug: string;
  tags: TagRow[];
  selectedTagSlug?: string | null;
  selectedSort: ShopAllBrowseSortParam;
  searchQuery?: string | null;
  browseFlat?: boolean;
}) {
  const basePath = shopAllPath(shopSlug);
  const qCommon = {
    q: searchQuery,
    flat: browseFlat,
    sort: selectedSort,
  } as const;

  const allHref = `${basePath}${shopAllQueryString({ ...qCommon, tag: null })}`;

  function sortHref(next: ShopAllBrowseSortParam) {
    return `${basePath}${shopAllQueryString({ ...qCommon, sort: next })}`;
  }

  return (
    <div className="mb-6 space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Browse</h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <nav
          aria-label="Filter by tag"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
        >
          <Link
            href={allHref}
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition sm:text-xs ${
              !selectedTagSlug?.trim()
                ? "border-blue-500/70 bg-blue-950/50 text-blue-200"
                : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            All
          </Link>
          {tags.map((t) => {
            const active = selectedTagSlug === t.slug;
            const href = `${basePath}${shopAllQueryString({
              ...qCommon,
              tag: t.slug,
            })}`;
            return (
              <Link
                key={t.slug}
                href={href}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition sm:text-xs ${
                  active
                    ? "border-blue-500/70 bg-blue-950/50 text-blue-200"
                    : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                {t.name}
              </Link>
            );
          })}
        </nav>
        <form
          method="get"
          action={basePath}
          className="flex w-full max-w-md flex-wrap items-center gap-2 sm:ml-auto sm:justify-end"
        >
          {selectedTagSlug?.trim() ? (
            <input type="hidden" name="tag" value={selectedTagSlug.trim()} />
          ) : null}
          {browseFlat ? <input type="hidden" name="flat" value="1" /> : null}
          {selectedSort !== "price" ? (
            <input type="hidden" name="sort" value={selectedSort} />
          ) : null}
          <label className="sr-only" htmlFor="shop-all-search-q">
            Search products
          </label>
          <input
            id="shop-all-search-q"
            name="q"
            type="search"
            defaultValue={searchQuery ?? ""}
            placeholder="Search name or keywords…"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            type="submit"
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            Search
          </button>
          {searchQuery?.trim() ? (
            <Link
              href={`${basePath}${shopAllQueryString({
                tag: selectedTagSlug,
                flat: browseFlat,
                sort: selectedSort,
              })}`}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>
      <nav
        aria-label="Sort listings"
        className="flex flex-wrap items-center gap-2 border-t border-zinc-800/60 pt-3 sm:border-t-0 sm:pt-0"
      >
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Sort</span>
        <Link
          href={sortHref("popular")}
          className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition sm:text-xs ${
            selectedSort === "popular"
              ? "border-blue-500/70 bg-blue-950/50 text-blue-200"
              : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          }`}
        >
          Popular
        </Link>
        <Link
          href={sortHref("new")}
          className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition sm:text-xs ${
            selectedSort === "new"
              ? "border-blue-500/70 bg-blue-950/50 text-blue-200"
              : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          }`}
        >
          New ↓
        </Link>
        <Link
          href={sortHref("price")}
          className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition sm:text-xs ${
            selectedSort === "price"
              ? "border-blue-500/70 bg-blue-950/50 text-blue-200"
              : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          }`}
        >
          Price ↑
        </Link>
      </nav>
    </div>
  );
}
