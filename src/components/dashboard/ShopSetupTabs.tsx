"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";
import { dashboardStartStripeConnect } from "@/actions/dashboard-marketplace";

export type ShopSetupShopPayload = {
  shopSlug: string;
  displayName: string;
  profileImageUrl: string | null;
  welcomeMessage: string | null;
  socialLinks: unknown;
  stripeConnectAccountId: string | null;
  connectChargesEnabled: boolean;
  payoutsEnabled: boolean;
};

export type ShopSetupSteps = {
  stripe: boolean;
  profile: boolean;
  listing: boolean;
};

const btnPrimary =
  "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed";
const btnPrimarySaving =
  "cursor-wait rounded-lg bg-zinc-100/70 px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300/60";

function StepIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/90 text-[10px] font-bold text-white"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  return (
    <span
      className="h-5 w-5 shrink-0 rounded-full border-2 border-zinc-600"
      aria-hidden
    />
  );
}

function StripeConnectSubmitButton({ defaultLabel }: { defaultLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={pending ? btnPrimarySaving : btnPrimary}
    >
      {pending ? "Saving..." : defaultLabel}
    </button>
  );
}

export function ShopSetupTabs(props: {
  shop: ShopSetupShopPayload;
  steps: ShopSetupSteps;
  /** When true, used inside dashboard tab panel (no top margin). */
  embedded?: boolean;
}) {
  const { shop, steps, embedded = false } = props;

  const stripeLabel = shop.stripeConnectAccountId
    ? "Continue Stripe onboarding"
    : "Start Stripe onboarding";

  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6 ${embedded ? "mt-0" : "mt-8"}`}
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Onboarding
      </h2>
      <p className="mt-1 text-xs text-zinc-600">
        Work through the checklist: shop profile, request a listing, then Stripe Connect at the
        bottom of this page. Shop name, photo, welcome message, and socials live on the Shop profile
        tab.
      </p>

      <nav
        className="mt-6 rounded-lg border border-zinc-800/80 bg-zinc-900/35 p-4"
        aria-label="Onboarding checklist"
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">To do</p>
        <ol className="mt-3 list-none space-y-3 p-0">
          <li className="flex gap-3">
            <StepIcon done={steps.profile} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Shop profile</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Display name, welcome message, profile photo (max 100 KiB), optional social links.
              </p>
              <Link
                href="/dashboard?dash=shopProfile"
                className="mt-1.5 inline-block text-xs font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
              >
                {steps.profile ? "Review / edit" : "Complete on Shop profile tab →"}
              </Link>
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.listing} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Request listing</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Submit a listing request from the Request listing tab when your shop profile looks
                right.
              </p>
              <Link
                href="/dashboard?dash=requestListing"
                className="mt-1.5 inline-block text-xs font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
              >
                Open Request listing tab →
              </Link>
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.stripe} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Stripe Connect</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Last step: connect payouts when marketplace Connect checkout is enabled.
              </p>
              <a
                href="#shop-setup-stripe"
                className="mt-1.5 inline-block text-xs font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
              >
                Form below ↓
              </a>
            </div>
          </li>
        </ol>
      </nav>

      <div className="mt-8 space-y-10">
        <section
          id="shop-setup-stripe"
          className="scroll-mt-4"
          aria-labelledby="shop-setup-stripe-heading"
        >
          <h3
            id="shop-setup-stripe-heading"
            className="text-sm font-semibold tracking-wide text-zinc-200"
          >
            Stripe Connect
          </h3>
          <p className="mt-1 text-xs text-zinc-500">Use this section when you are ready to connect.</p>
          <div className="mt-4 space-y-4 text-sm text-zinc-300">
            <p>
              Connect Stripe so payouts can reach your bank when{" "}
              <code className="text-zinc-500">MARKETPLACE_STRIPE_CONNECT=1</code> is enabled for
              checkout.
            </p>
            <ul className="list-inside list-disc text-xs text-zinc-500">
              <li>Charges enabled: {shop.connectChargesEnabled ? "yes" : "no"}</li>
              <li>Payouts enabled: {shop.payoutsEnabled ? "yes" : "no"}</li>
              <li className="truncate">
                Account: {shop.stripeConnectAccountId ?? "not created yet"}
              </li>
            </ul>
            <form action={dashboardStartStripeConnect}>
              <StripeConnectSubmitButton defaultLabel={stripeLabel} />
            </form>
          </div>
        </section>

        <div className="border-t border-zinc-800 pt-6">
          <p className="text-xs text-zinc-500">
            Request a listing from the checklist above or the{" "}
            <Link
              href="/dashboard?dash=requestListing"
              className="text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
            >
              Request listing
            </Link>{" "}
            tab.
          </p>
        </div>
      </div>
    </section>
  );
}
