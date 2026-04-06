import Link from "next/link";
import { SHOP_DOMME_ROUTE, SHOP_SUB_ROUTE } from "@/lib/constants";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-4 py-16">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-400/80">
          Xtinadom
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Merch
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-zinc-400">
          Browse two collections — same checkout and cart. Pick either shop below.
        </p>
      </header>

      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        <Link
          href={SHOP_SUB_ROUTE}
          className="group flex flex-col rounded-2xl border border-rose-900/50 bg-gradient-to-b from-rose-950/40 to-zinc-950 p-8 transition hover:border-rose-700/60 hover:from-rose-950/55"
        >
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-rose-400/90">
            Collection
          </span>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Sub</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
            Photo-printed pieces, stickers, and sub-audience favorites.
          </p>
          <span className="mt-6 text-sm font-medium text-rose-300 group-hover:text-rose-200">
            Browse sub shop →
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
            Browse domme shop →
          </span>
        </Link>
      </div>
    </main>
  );
}
