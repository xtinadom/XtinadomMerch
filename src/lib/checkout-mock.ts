import { prisma } from "@/lib/prisma";
import { FulfillmentType, OrderStatus } from "@/generated/prisma/enums";

/** Prefix for fake Stripe session ids when MOCK_CHECKOUT=1. */
export const MOCK_SESSION_PREFIX = "mock_" as const;

export function isMockCheckoutEnabled(): boolean {
  return process.env.MOCK_CHECKOUT === "1";
}

export function parseMockOrderId(sessionId: string): string | null {
  if (!sessionId.startsWith(MOCK_SESSION_PREFIX)) return null;
  const id = sessionId.slice(MOCK_SESSION_PREFIX.length);
  return id.length > 0 ? id : null;
}

const expectedMockSessionId = (orderId: string) => `${MOCK_SESSION_PREFIX}${orderId}`;

/**
 * Marks a mock order paid and decrements manual inventory (mirrors webhook essentials).
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
    if (updated.count === 0) return;
    transitioned = true;

    for (const line of order.lines) {
      if (
        line.fulfillmentType === FulfillmentType.manual &&
        line.product.trackInventory
      ) {
        const r = await tx.product.updateMany({
          where: {
            id: line.productId,
            stockQuantity: { gte: line.quantity },
          },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        if (r.count === 0) {
          console.error(
            `[mock checkout] Stock race for product ${line.productId} order ${orderId}`,
          );
        }
      }
    }
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
