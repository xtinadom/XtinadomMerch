import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function ShopRegulationsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Shop regulations</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-400">
        <p>
          Creators who operate a shop on this marketplace agree to follow platform rules: accurate listings,
          lawful content, honoring fulfilled orders, and cooperating with moderation and fraud checks.
        </p>
        <p>
          This page is placeholder copy. Add prohibited content, payout holds, strike policies, and how
          shops appeal enforcement decisions.
        </p>
      </div>
      <p className="mt-10">
        <Link href="/" className="text-sm text-blue-400/90 hover:underline">
          ← Home
        </Link>
      </p>
      <SiteLegalFooter />
    </main>
  );
}
