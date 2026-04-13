import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function ReturnsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Returns &amp; refunds</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-400">
        <p>
          Print-on-demand and custom merchandise may be produced only after you place an order. Many
          platforms therefore limit returns except for misprints, defects, or shipping damage.
        </p>
        <p>
          This page is placeholder copy. Document your actual return window, who pays return shipping, and
          how buyers should open a claim (email, form, or ticket system).
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
