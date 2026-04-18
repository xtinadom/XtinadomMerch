import { ListingRequestStatus } from "@/generated/prisma/enums";

export type ShopOnboardingSteps = {
  profile: boolean;
  guidelines: boolean;
  emailVerified: boolean;
  listing: boolean;
  stripe: boolean;
};

export function computeShopOnboardingSteps(input: {
  displayName: string;
  itemGuidelinesAcknowledgedAt: Date | null;
  emailVerifiedAt: Date | null;
  listings: { requestStatus: ListingRequestStatus; active: boolean }[];
  connectChargesEnabled: boolean;
  payoutsEnabled: boolean;
}): ShopOnboardingSteps {
  const profile = input.displayName.trim().length > 0;
  const guidelines = input.itemGuidelinesAcknowledgedAt != null;
  const emailVerified = input.emailVerifiedAt != null;
  const listing = input.listings.some(
    (l) =>
      l.requestStatus === ListingRequestStatus.submitted ||
      l.requestStatus === ListingRequestStatus.images_ok ||
      l.requestStatus === ListingRequestStatus.printify_item_created ||
      l.requestStatus === ListingRequestStatus.approved ||
      l.active,
  );
  const stripe = input.connectChargesEnabled && input.payoutsEnabled;
  return { profile, guidelines, emailVerified, listing, stripe };
}

export function countIncompleteOnboardingSteps(steps: ShopOnboardingSteps): number {
  let n = 0;
  if (!steps.profile) n++;
  if (!steps.guidelines) n++;
  if (!steps.emailVerified) n++;
  if (!steps.listing) n++;
  if (!steps.stripe) n++;
  return n;
}

/** Stripe Connect is allowed only after the non-Stripe checklist is done. */
export function canStartStripeConnect(
  steps: Pick<ShopOnboardingSteps, "profile" | "guidelines" | "emailVerified" | "listing">,
): boolean {
  return steps.profile && steps.guidelines && steps.emailVerified && steps.listing;
}
