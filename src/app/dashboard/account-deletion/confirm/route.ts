import { NextResponse } from "next/server";
import { confirmShopAccountDeletionFromRawToken } from "@/lib/shop-account-deletion";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  const r = await confirmShopAccountDeletionFromRawToken(t);

  if (!r.ok) {
    const reason =
      r.reason === "expired"
        ? "expired"
        : r.reason === "missing"
          ? "missing"
          : "invalid";
    return NextResponse.redirect(
      new URL(`/dashboard?dash=setup&delConfirm=${reason}`, url.origin),
      302,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/shops");
  return NextResponse.redirect(new URL("/dashboard?dash=setup&delConfirm=ok", url.origin), 302);
}
