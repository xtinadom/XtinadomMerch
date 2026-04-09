import Link from "next/link";
import {
  SHOP_ALL_ROUTE,
  SHOP_DOMME_ROUTE,
  SHOP_SUB_ROUTE,
} from "@/lib/constants";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-16">
      <header className="text-center">
        <p className="store-dimension-brand text-xs uppercase tracking-[0.2em] text-blue-400/80">
          XTINADOM
        </p>
        <h1 className="store-dimension-page-title mt-3 text-3xl text-zinc-50 sm:text-4xl">
          Merch
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-zinc-400">
          One shop and one cart. Narrow by Sub or Domme collection below, or open the
          full catalog at the end of this page.
        </p>
      </header>

      <p className="mt-12 text-center text-xs font-medium uppercase tracking-wide text-zinc-600">
        Start from a collection
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Link
          href={SHOP_SUB_ROUTE}
          className="group flex flex-col rounded-2xl border border-blue-900/50 bg-gradient-to-b from-blue-950/40 to-zinc-950 p-8 transition hover:border-blue-700/60 hover:from-blue-950/55"
        >
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-blue-400/90">
            Collection
          </span>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Sub</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
            Photo-printed pieces, stickers, and sub-audience favorites.
          </p>
          <span className="mt-6 text-sm font-medium text-blue-300 group-hover:text-blue-200">
            Browse Sub collection →
          </span>
        </Link>

        <Link
          href={SHOP_DOMME_ROUTE}
          className="group flex flex-col rounded-2xl border border-zinc-700 bg-zinc-900/40 p-8 transition hover:border-zinc-500 hover:bg-zinc-900/60"
        >
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
            Collection
          </span>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Domme</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
            Domme-audience merch and staples — mugs, apparel, and more.
          </p>
          <span className="mt-6 text-sm font-medium text-zinc-300 group-hover:text-zinc-100">
            Browse Domme collection →
          </span>
        </Link>
      </div>

      <div className="mt-20 border-t border-zinc-800/80 pt-10 text-center">
        <Link
          href={SHOP_ALL_ROUTE}
          className="text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-blue-400/90 hover:decoration-blue-400/50"
        >
          View all products
        </Link>
        <p className="mt-3 text-xs text-zinc-600">
          Full catalog — every active item, tag, and collection.
        </p>
      </div>
    </main>
  );
}
