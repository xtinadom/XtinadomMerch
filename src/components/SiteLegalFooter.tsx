import Link from "next/link";
import { startSupportSiteCheckout } from "@/actions/support-site";
import {
  configuredSupportTipCents,
  isSupportCheckoutConfigured,
} from "@/lib/support-site";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function SiteLegalFooter() {
  const supportAvailable = isSupportCheckoutConfigured();
  const tipCents = configuredSupportTipCents();
  const tipLabel = formatUsd(tipCents);

  return (
    <footer className="mt-16 border-t border-zinc-800/80 pt-8 text-center text-xs text-zinc-500">
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        <Link href="/about" className="hover:text-blue-400/90">
          About
        </Link>
        <Link href="/returns" className="hover:text-blue-400/90">
          Returns &amp; refunds
        </Link>
        <Link href="/privacy" className="hover:text-blue-400/90">
          Privacy
        </Link>
        <Link href="/shop-regulations" className="hover:text-blue-400/90">
          Shop regulations
        </Link>
        <Link
          href="/admin"
          className="store-kicker text-zinc-600 transition hover:text-zinc-400"
        >
          Admin
        </Link>
      </nav>
      {supportAvailable ? (
        <div className="mt-6 max-w-md mx-auto space-y-2">
          <form action={startSupportSiteCheckout}>
            <button
              type="submit"
              className="text-sm font-medium text-blue-400/90 transition hover:text-blue-300"
            >
              {"Support the site <3"}
            </button>
          </form>
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Voluntary one-time tip ({tipLabel}) via card — goes to the site operator, not shop payouts.
          </p>
        </div>
      ) : null}
    </footer>
  );
}
