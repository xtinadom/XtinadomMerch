import { NextRequest, NextResponse } from "next/server";
import { verifyShopEmailFromRawToken } from "@/lib/shop-email-verification";

export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("t");
  const result = await verifyShopEmailFromRawToken(t);
  const url = new URL("/dashboard", request.url);
  if (result.ok) {
    url.searchParams.set("emailVerify", "ok");
  } else {
    url.searchParams.set("emailVerify", result.reason);
  }
  return NextResponse.redirect(url);
}
