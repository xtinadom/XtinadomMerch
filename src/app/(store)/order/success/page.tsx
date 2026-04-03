import Link from "next/link";
import { clearCartAfterPaidSession } from "@/actions/order";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function OrderSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;
  if (session_id) {
    await clearCartAfterPaidSession(session_id);
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-semibold text-zinc-50">Thank you</h1>
      <p className="mt-4 text-sm text-zinc-400">
        Your payment was received. You will get a confirmation from Stripe by email
        when provided. Print-on-demand orders are sent to our fulfillment partner
        automatically; used items are packed by Xtinadom.
      </p>
      {session_id && (
        <p className="mt-4 font-mono text-xs text-zinc-600">
          Reference: {session_id.slice(0, 24)}…
        </p>
      )}
      <Link
        href="/shop"
        className="mt-8 inline-block rounded-xl bg-zinc-800 px-6 py-3 text-sm text-zinc-100 hover:bg-zinc-700"
      >
        Continue shopping
      </Link>
    </div>
  );
}
