import Link from "next/link";

export function CreatorMerchWebsitePromo() {
  return (
    <aside className="rounded-xl border border-blue-900/40 bg-gradient-to-br from-blue-950/50 to-zinc-900/80 p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-blue-400/90">
        Service
      </p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-100 sm:text-xl">
        Want your own merch website?
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
        We can set up a shop like this one for your brand — products, checkout,
        print-on-demand, and your look and feel. Tell us what you need and
        we&apos;ll send a quote.
      </p>
      <Link
        href="/contact"
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800"
      >
        Contact us for a quote
      </Link>
    </aside>
  );
}
