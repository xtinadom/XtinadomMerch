import Link from "next/link";
import { acknowledgeShopItemGuidelines } from "@/actions/dashboard-shop-setup";

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
      <p className="mt-1 text-xs text-zinc-600">
        Read this before requesting listings. Submitting a listing means you agree to these rules.
      </p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-300">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rights to images</h3>
          <p className="mt-2 text-sm text-zinc-400">
            You must own every photo, artwork file, and reference image you upload or link for a listing. You are solely
            responsible for what you upload.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Platform review</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Admin review (including approval of images) is not legal clearance. If a rights or content issue is
            discovered later, you remain responsible. The platform is not liable for having approved an image that is
            later shown to infringe someone else&apos;s rights or violate these guidelines.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Content standards</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Images must pass typical social-media style checks: no nudity, no depicted sex acts, and no explicit sexual
            content. Artful, suggestive content may be acceptable when it stays within those bounds. The platform may
            reject or remove listings that do not meet this standard.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fees</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Your first 3 listings are free. Listings after that are 25 cents.
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Listing fees paid for items that are rejected or removed later for not following these guidelines, are{" "}
            <strong className="text-zinc-200">non-refundable</strong>.
          </p>
        </div>

        <p className="text-xs text-zinc-600">
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
