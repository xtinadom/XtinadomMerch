"use server";

import { getStripe } from "@/lib/stripe";
import { clearCart } from "@/actions/cart";

export async function clearCartAfterPaidSession(sessionId: string) {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      await clearCart();
    }
  } catch {
    // ignore invalid session id
  }
}
