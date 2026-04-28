import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PromotionPurchaseStatus } from "@/generated/prisma/enums";

/**
 * Marks a promotion purchase paid (Stripe webhook or embedded card confirmation). Idempotent for `paid`.
 */
export async function fulfillPromotionPurchasePaidIfPending(
  purchaseId: string,
  stripe: {
    paymentIntentId: string;
    chargeId?: string | null;
    /** When set (e.g. from PaymentIntent.amount), must match the row amount. */
    paidAmountCents?: number;
  },
): Promise<boolean> {
  const purchase = await prisma.promotionPurchase.findUnique({
    where: { id: purchaseId },
    select: { id: true, status: true, amountCents: true },
  });
  if (!purchase) return false;
  if (purchase.status === PromotionPurchaseStatus.paid) return true;
  if (purchase.status !== PromotionPurchaseStatus.pending) return false;

  if (
    stripe.paidAmountCents !== undefined &&
    stripe.paidAmountCents !== purchase.amountCents
  ) {
    return false;
  }

  await prisma.promotionPurchase.update({
    where: { id: purchaseId },
    data: {
      status: PromotionPurchaseStatus.paid,
      paidAt: new Date(),
      stripePaymentIntentId: stripe.paymentIntentId,
      stripeChargeId: stripe.chargeId ?? null,
    },
  });
  revalidatePath("/dashboard");
  return true;
}
