import Link from "next/link";
import { ItemGuidelinesArticle } from "@/components/ItemGuidelinesArticle";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function ShopRegulationsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Shop regulations</h1>
      <p className="mt-2 text-sm text-zinc-500">
        The rules below are the same <strong className="font-medium text-zinc-400">item guidelines</strong> creators
        see during onboarding.
      </p>
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Item guidelines</h2>
        <ItemGuidelinesArticle className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-300" />
      </div>
      <p className="mt-4 text-xs text-zinc-600">
        Acknowledge these in your dashboard under{" "}
        <Link
          href="/dashboard?dash=itemGuidelines"
          className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300"
        >
          Onboarding → Item guidelines
        </Link>
        .
      </p>
      <p className="mt-10">
        <Link href="/" className="text-sm text-blue-400/90 hover:underline">
          ← Home
        </Link>
      </p>
      <SiteLegalFooter />
    </main>
  );
}
