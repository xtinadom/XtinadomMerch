import { prisma } from "@/lib/prisma";

const KIND = "stripe_connect_required_listing_fees";

/** One unread notice per shop until read — avoids spamming the Notifications tab. */
export async function ensureListingFeeStripeConnectNotice(shopId: string): Promise<void> {
  const existing = await prisma.shopOwnerNotice.findFirst({
    where: { shopId, kind: KIND, readAt: null },
  });
  if (existing) return;
  await prisma.shopOwnerNotice.create({
    data: {
      shopId,
      kind: KIND,
      body:
        "Finish Stripe Connect on the Onboarding tab (charges and payouts enabled) before you can add listings with a publication fee or pay one from the Listings tab.",
    },
  });
}
