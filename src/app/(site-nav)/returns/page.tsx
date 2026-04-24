import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function ReturnsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Return &amp; Refund Policy</h1>
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-zinc-400">
        <p>
          All products are custom-made and printed on demand. Because of this, we do not accept returns,
          exchanges, or offer refunds for any reason other than a verified production error or product defect.
        </p>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">No Returns or Exchanges</h2>
          <p>We do not accept returns or exchanges for:</p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Incorrect size selection</li>
            <li>Buyer&apos;s remorse</li>
            <li>Accidental orders</li>
            <li>Shipping delays outside our control</li>
          </ul>
          <p>Please review all product details carefully before placing your order.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Damaged, Defective, or Misprinted Items</h2>
          <p>
            If your item arrives with a printing error, defect, or damage, you may be eligible for a
            replacement or refund.
          </p>
          <p className="font-medium text-zinc-300">To qualify:</p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>You must contact us within 7 days of delivery</li>
            <li>You must provide clear photo evidence showing the issue</li>
          </ul>
          <p className="font-medium text-zinc-300">Once reviewed and approved, we will:</p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Offer a free replacement, or</li>
            <li>Issue a refund (at our discretion)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Incorrect Address / Unclaimed Packages</h2>
          <p>
            Orders returned due to incorrect shipping information or being unclaimed are not eligible for
            refund. In some cases, reshipping may be offered at the customer&apos;s expense.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Lost, Stolen, or Delivered Packages</h2>
          <p>
            We are not responsible for lost or stolen packages marked as delivered by the carrier.
          </p>
          <p>
            Once an order is marked as delivered to the shipping address provided at checkout, liability
            transfers to the customer. We do not issue refunds or replacements for:
          </p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Packages reported as stolen after delivery</li>
            <li>Packages delivered to the correct address but not received</li>
          </ul>
          <p>
            If you believe your package was stolen, we recommend contacting the shipping carrier directly or
            filing a claim with your local authorities.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Order Cancellations</h2>
          <p>
            Orders are processed quickly after purchase. Once production has begun, orders cannot be canceled
            or modified.
          </p>
        </section>
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
