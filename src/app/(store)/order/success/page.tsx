import Link from "next/link";
import { clearCartAfterPaidSession } from "@/actions/order";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function OrderSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;
  if (session_id) {
    await clearCartAfterPaidSession(session_id);
  }

  return (
    <StoreDocumentPanel backHref={SHOP_ALL_ROUTE} backLabel="Continue shopping" title="Thank you">
      <div className="text-center">
        <p className="text-sm leading-relaxed text-zinc-400">
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
          href={SHOP_ALL_ROUTE}
          className="mt-8 inline-block rounded-xl bg-blue-900/90 px-6 py-3 text-sm font-medium text-white hover:bg-blue-800"
        >
          Continue shopping
        </Link>
      </div>
    </StoreDocumentPanel>
  );
}
