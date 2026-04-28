"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { dashboardStartStripeConnect } from "@/actions/dashboard-marketplace";
import { resendShopEmailVerification } from "@/actions/shop-email-verify";

export type ShopSetupShopPayload = {
  shopSlug: string;
  displayName: string;
  /** When true, shop may appear on `/shops` and home “top shops”; storefront stays linkable either way. */
  listedOnShopsBrowse: boolean;
  profileImageUrl: string | null;
  welcomeMessage: string | null;
  socialLinks: unknown;
  stripeConnectAccountId: string | null;
  connectChargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountDeletionRequestedAt: string | null;
  accountDeletionEmailConfirmedAt: string | null;
  /** Stripe USD cents when deletion email is confirmed (for gating final delete); null otherwise. */
  stripeConnectBalance: { availableCents: number; pendingCents: number } | null;
};

export type ShopSetupSteps = {
  profile: boolean;
  guidelines: boolean;
  emailVerified: boolean;
  listing: boolean;
  stripe: boolean;
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

/** Stripe Connect stays locked until these are all true — list only what is still missing (clearer than a generic wall of text). */
function incompleteStripePrerequisitesSummary(steps: ShopSetupSteps): string {
  const missing: string[] = [];
  if (!steps.profile) missing.push("shop profile (display name)");
  if (!steps.guidelines) missing.push("item guidelines");
  if (!steps.emailVerified) missing.push("email verification");
  if (!steps.listing) missing.push("a listing request");
  if (missing.length === 0) {
    return "Finish the remaining onboarding checklist items before starting Stripe Connect.";
  }
  if (missing.length === 1) {
    return `Complete ${missing[0]} before starting Stripe Connect.`;
  }
  if (missing.length === 2) {
    return `Complete ${missing[0]} and ${missing[1]} before starting Stripe Connect.`;
  }
  const last = missing[missing.length - 1]!;
  const rest = missing.slice(0, -1).join(", ");
  return `Complete ${rest}, and ${last} before starting Stripe Connect.`;
}

function StripeConnectSubmitButton({
  defaultLabel,
  formDisabled,
}: {
  defaultLabel: string;
  formDisabled: boolean;
}) {
  const { pending } = useFormStatus();
  const disabled = pending || formDisabled;
  return (
    <button
      type="submit"
      disabled={disabled}
      className={pending ? btnPrimarySaving : btnPrimary}
    >
      {pending ? "Saving..." : defaultLabel}
    </button>
  );
}

function ShopEmailVerificationCallout({ verified }: { verified: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  if (verified) {
    return (
      <p className="text-xs text-emerald-300/90">
        Email verified — you&apos;re all set for this step.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">
        We sent a verification link to your inbox when you created the shop. Didn&apos;t get it?
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await resendShopEmailVerification();
            if (r.ok) setMsg({ tone: "ok", text: r.message });
            else setMsg({ tone: "err", text: r.error });
          });
        }}
        className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Resend verification email"}
      </button>
      {msg ? (
        <p
          className={
            msg.tone === "ok"
              ? "text-xs text-emerald-300/90"
              : "text-xs text-amber-300/90"
          }
          role="status"
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}

export function ShopSetupTabs(props: {
  shop: ShopSetupShopPayload;
  steps: ShopSetupSteps;
  stripeConnectUnlocked: boolean;
  /** When true, used inside dashboard tab panel (no top margin). */
  embedded?: boolean;
}) {
  const { shop, steps, stripeConnectUnlocked, embedded = false } = props;

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
                Set your <strong className="text-zinc-400">shop display name</strong> (store name). Username, welcome
                message, profile photo, and social links are optional.
              </p>
              <Link
                href="/dashboard?dash=shopProfile"
                className="mt-1.5 inline-block text-xs font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
              >
                {steps.profile ? "Review / edit" : "Open Shop profile tab →"}
              </Link>
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.guidelines} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Read item guidelines</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Rights to photos, content rules, fees for rejected or removed listings, and liability.
              </p>
              <Link
                href="/dashboard?dash=itemGuidelines"
                className="mt-1.5 inline-block text-xs font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
              >
                {steps.guidelines
                  ? "Review Item guidelines tab →"
                  : "Open Item guidelines (next to Onboarding) →"}
              </Link>
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.emailVerified} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Verify email</p>
              <p className="mt-0.5 text-xs text-zinc-500">Click the link in the email we sent to your shop account.</p>
              <div className="mt-2">
                <ShopEmailVerificationCallout verified={steps.emailVerified} />
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.listing} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Request listing</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Submit at least one listing request from the Request listing tab.
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
          <div className="mt-4 space-y-4 text-sm text-zinc-300">
            {!stripeConnectUnlocked ? (
              <p className="rounded-lg border border-amber-900/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
                {incompleteStripePrerequisitesSummary(steps)}
              </p>
            ) : null}
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
              <StripeConnectSubmitButton defaultLabel={stripeLabel} formDisabled={!stripeConnectUnlocked} />
            </form>
          </div>
        </section>
      </div>
    </section>
  );
}
