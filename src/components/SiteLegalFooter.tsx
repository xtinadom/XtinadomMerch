import Link from "next/link";

export function SiteLegalFooter() {
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
    </footer>
  );
}
