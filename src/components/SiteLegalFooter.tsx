import Link from "next/link";
import { SupportSiteCta } from "@/components/SupportSiteCta";
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
  const tipLabel = formatUsd(configuredSupportTipCents());

  return (
    <footer className="mt-16 border-t border-zinc-800/80 pt-8 text-center text-xs text-zinc-500">
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        <Link href="/about" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
          About
        </Link>
        <Link href="/returns" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
          Returns &amp; refunds
        </Link>
        <Link href="/privacy" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
          Privacy
        </Link>
        <Link href="/shop-regulations" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
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
        <div className="mt-6 max-w-md mx-auto">
          <SupportSiteCta tipLabel={tipLabel} />
        </div>
      ) : null}
    </footer>
  );
}
