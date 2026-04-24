import Link from "next/link";
import { acknowledgeShopItemGuidelines } from "@/actions/dashboard-shop-setup";
import { ItemGuidelinesArticle } from "@/components/ItemGuidelinesArticle";

export function ShopItemGuidelinesPanel(props: {
  acknowledged: boolean;
  /** When true, used inside dashboard tab panel (no top margin). */
  embedded?: boolean;
}) {
  const { acknowledged, embedded = false } = props;

  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6 ${embedded ? "mt-0" : "mt-8"}`}
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Item guidelines</h2>

      <div className="mt-4">
        <ItemGuidelinesArticle className="space-y-4 text-sm leading-relaxed text-zinc-300" />

        <p className="mt-4 text-xs text-zinc-600">
          This page is a practical summary, not legal advice. For storefront policies fans see, see also{" "}
          <Link href="/shop-regulations" className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300">
            shop regulations
          </Link>
          .
        </p>

        <form action={acknowledgeShopItemGuidelines} className="pt-2">
          <button
            type="submit"
            disabled={acknowledged}
            className={
              acknowledged
                ? "cursor-default rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-300"
                : "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
            }
          >
            {acknowledged ? "Marked as read" : "I have read and acknowledge the item guidelines"}
          </button>
        </form>
      </div>
    </section>
  );
}
