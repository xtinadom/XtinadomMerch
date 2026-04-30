import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/generated/prisma/enums";

/** Prefix for fake Stripe session ids when MOCK_CHECKOUT=1. */
export const MOCK_SESSION_PREFIX = "mock_" as const;

/**
 * Use mock / demo payments (no Stripe keys, no card UI). Set either env in `.env.local`:
 * - `DEMO_MODE=1` — preferred name for local work before Stripe is configured
 * - `MOCK_CHECKOUT=1` — legacy alias (same behavior)
 */
export function isMockCheckoutEnabled(): boolean {
  return process.env.MOCK_CHECKOUT === "1" || process.env.DEMO_MODE === "1";
}

export function parseMockOrderId(sessionId: string): string | null {
  if (!sessionId.startsWith(MOCK_SESSION_PREFIX)) return null;
  const id = sessionId.slice(MOCK_SESSION_PREFIX.length);
  return id.length > 0 ? id : null;
}

const expectedMockSessionId = (orderId: string) => `${MOCK_SESSION_PREFIX}${orderId}`;

/**
 * Marks a mock order paid (mirrors webhook order status transition).
 * Does not call Stripe or Printify.
 */
export async function completeMockPaidOrder(
  orderId: string,
): Promise<"paid" | "already_paid" | "invalid"> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  });
  if (!order) return "invalid";

  if (order.status === OrderStatus.paid) {
    return order.stripeSessionId === expectedMockSessionId(orderId)
      ? "already_paid"
      : "invalid";
  }

  if (order.status !== OrderStatus.pending_payment) return "invalid";

  const mockPi = `mock_pi_${orderId}`;

  let transitioned = false;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.pending_payment },
      data: {
        status: OrderStatus.paid,
        stripePaymentIntentId: mockPi,
      },
    });
    if ((updated?.count ?? 0) === 0) return;
    transitioned = true;
  });

  if (transitioned) return "paid";

  const again = await prisma.order.findUnique({ where: { id: orderId } });
  if (
    again?.status === OrderStatus.paid &&
    again.stripeSessionId === expectedMockSessionId(orderId)
  ) {
    return "already_paid";
  }
  return "invalid";
}
