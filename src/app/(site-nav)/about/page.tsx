import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">About</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-400">
        <p>
          Creator Shops is a multi-vendor marketplace built on a shared catalog and unified fulfillment.
          Independent creators operate their own storefronts while checkout and operations stay consistent
          for buyers.
        </p>
        <p>
          This page is placeholder copy. Replace it with your brand story, contact channels, and any
          disclosures your counsel requires.
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
