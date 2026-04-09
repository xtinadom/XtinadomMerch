import { NextResponse } from "next/server";
import { loadCartCheckoutState } from "@/lib/cart-checkout-state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await loadCartCheckoutState();
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: "cart_unavailable" }, { status: 500 });
  }
}
