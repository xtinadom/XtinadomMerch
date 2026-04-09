export function DommeMerchWebsitePromo() {
  const email = process.env.NEXT_PUBLIC_MERCH_QUOTE_EMAIL?.trim();
  const subject = encodeURIComponent("Merch website quote");

  return (
    <aside className="rounded-xl border border-rose-900/40 bg-gradient-to-br from-rose-950/50 to-zinc-900/80 p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-rose-400/90">
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
      {email ? (
        <a
          href={`mailto:${email}?subject=${subject}`}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-600"
        >
          Contact us for a quote
        </a>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          Add{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-400">
            NEXT_PUBLIC_MERCH_QUOTE_EMAIL
          </code>{" "}
          to your environment to enable the email link.
        </p>
      )}
    </aside>
  );
}
