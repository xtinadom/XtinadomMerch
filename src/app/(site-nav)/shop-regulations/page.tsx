import Link from "next/link";
import { ItemGuidelinesArticle } from "@/components/ItemGuidelinesArticle";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function ShopRegulationsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Shop regulations</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Items that go against regulations will be promptly rejected/removed.
      </p>
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Item guidelines</h2>
        <ItemGuidelinesArticle className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-300" />
      </div>
      <p className="mt-4 text-xs text-zinc-600">
        While you still have onboarding steps pending, acknowledge from your{" "}
        <Link
          href="/dashboard"
          className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300"
        >
          shop dashboard
        </Link>{" "}
        (open the Shop regulations tab next to Onboarding). After setup is complete, use this page anytime to review the
        same rules.
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
