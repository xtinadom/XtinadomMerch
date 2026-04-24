import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Effective date: <span className="text-zinc-400">April 2026</span>
      </p>
      <div className="mt-6 space-y-8 text-sm leading-relaxed text-zinc-400">
        <p>
          This Privacy Policy describes how we collect, use, and protect your information when you use our
          platform.
        </p>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">1. Information the platform collects</h2>
          <p>We collect the following types of information:</p>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">Personal Information</h3>
            <ul className="list-inside list-disc space-y-1 pl-1">
              <li>Name</li>
              <li>Email address</li>
              <li>Shipping and billing address</li>
              <li>Phone number (if provided)</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">Order Information</h3>
            <ul className="list-inside list-disc space-y-1 pl-1">
              <li>Products purchased</li>
              <li>Order details and transaction history</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">Payment Information</h3>
            <p>
              Payments are processed securely by Stripe. We do not store or have access to your full payment
              details (such as complete credit card numbers).
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">Technical Data</h3>
            <ul className="list-inside list-disc space-y-1 pl-1">
              <li>IP address</li>
              <li>Browser type and device information</li>
              <li>Usage data (pages visited, interactions)</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">2. Platform-Controlled Data</h2>
          <p>All customer data is collected and controlled solely by the platform.</p>
          <p>
            Independent creators, sellers, or storefront owners on the platform do not have access to
            customers&apos; personal information, including:
          </p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Names</li>
            <li>Email addresses</li>
            <li>Shipping or billing addresses</li>
            <li>Payment information</li>
          </ul>
          <p>
            Creators only receive limited, non-identifiable order details necessary to fulfill products
            (e.g., product type, quantity, and design specifications), unless otherwise explicitly stated.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">3. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Process and fulfill orders</li>
            <li>Coordinate with print and shipping partners</li>
            <li>Communicate with you regarding your order or support requests</li>
            <li>Provide customer service</li>
            <li>Improve our platform and user experience</li>
            <li>Prevent fraud and ensure platform security</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">4. Payment Processing</h2>
          <p>
            All payments are handled by Stripe, a third-party payment processor. By making a purchase, you
            agree to Stripe&apos;s processing of your payment information in accordance with their privacy
            policy.
          </p>
          <p>We only receive limited information from Stripe, such as:</p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Payment status (successful/failed)</li>
            <li>Partial payment details (e.g., last 4 digits of card)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">5. Sharing of Information</h2>
          <p>We do not sell your personal information.</p>
          <p>We may share your information with:</p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Print fulfillment partners to produce your items</li>
            <li>Shipping carriers to deliver your orders</li>
            <li>Service providers (hosting, analytics, customer support tools)</li>
            <li>Legal authorities if required by law</li>
          </ul>
          <p>Creators and sellers on the platform are not provided access to personal customer data.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">6. Data Retention</h2>
          <p>We retain your information only as long as necessary to:</p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Fulfill orders</li>
            <li>Maintain records for legal, tax, and accounting purposes</li>
            <li>Resolve disputes and enforce our policies</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">7. Cookies and Tracking</h2>
          <p>We may use cookies and similar technologies to:</p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Keep you logged in</li>
            <li>Remember your preferences</li>
            <li>Analyze site traffic and performance</li>
          </ul>
          <p>You can control cookies through your browser settings.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">8. Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction or deletion of your data</li>
            <li>Object to or restrict certain processing</li>
          </ul>
          <p>
            To make a request, contact us at:{" "}
            <span className="text-zinc-300">[Insert Contact Email]</span>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">9. Data Security</h2>
          <p>
            We implement reasonable technical and organizational measures to protect your information.
            However, no method of transmission over the internet is 100% secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">10. Children&apos;s Privacy</h2>
          <p>
            Our platform is not intended for individuals under the age of 13, and we do not knowingly collect
            personal information from children.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page with an
            updated effective date.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">12. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at:{" "}
            <span className="text-zinc-300">[Insert Contact Email]</span>
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
