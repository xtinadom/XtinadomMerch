"use server";

import { getStripe } from "@/lib/stripe";
import {
  completeMockPaidOrder,
  isMockCheckoutEnabled,
  parseMockOrderId,
} from "@/lib/checkout-mock";
import { clearCart } from "@/actions/cart";

export async function clearCartAfterPaidSession(sessionId: string) {
  try {
    const mockOrderId = parseMockOrderId(sessionId);
    if (mockOrderId) {
      if (!isMockCheckoutEnabled()) return;
      const outcome = await completeMockPaidOrder(mockOrderId);
      if (outcome === "paid" || outcome === "already_paid") {
        await clearCart();
      }
      return;
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      await clearCart();
    }
  } catch {
    // ignore invalid session id
  }
}
