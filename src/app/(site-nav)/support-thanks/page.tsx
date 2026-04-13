import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function SupportThanksPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-zinc-50">Thank you</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        Your support means a lot. Every voluntary tip helps keep the site running and improving.
      </p>
      <p className="mt-10">
        <Link href="/" className="text-sm text-blue-400/90 hover:underline">
          ← Back home
        </Link>
      </p>
      <SiteLegalFooter />
    </main>
  );
}
