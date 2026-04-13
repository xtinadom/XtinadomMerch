import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Privacy</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-400">
        <p>
          This placeholder describes, at a high level, that the site processes order and account data to
          run the store (payment processors, email, hosting, and fulfillment partners).
        </p>
        <p>
          Replace this with a lawyer-reviewed privacy policy that lists categories of data, purposes,
          retention, subprocessors, and regional rights (GDPR, CCPA, etc.) as applicable.
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
