"use client";

import { PromotionPurchaseStatus } from "@/generated/prisma/enums";
import { ListingsTabExpandSection } from "@/components/dashboard/ListingsTabExpandSection";
import { PromotionCardPay } from "@/components/dashboard/PromotionCardPay";
import { MockPromotionPayForm } from "@/components/dashboard/MockPromotionPayForm";
import {
  parsePromotionKind,
  promotionKindLabel,
  promotionKindRequiresListing,
  promotionKindSurfaceDescription,
} from "@/lib/promotions";
import { PromotionKind } from "@/generated/prisma/enums";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatPaidDateMdYy(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  } catch {
    return iso;
  }
}

export type DashboardPromotionPurchaseRow = {
  id: string;
  kind: string;
  status: string;
  amountCents: number;
  createdAtIso: string;
  paidAtIso: string | null;
  listingLabel: string | null;
};

export function ListingsPromotedSection(props: {
  purchases: DashboardPromotionPurchaseRow[];
  liveListingPicklist: { id: string; label: string }[];
  mockPromotionCheckout: boolean;
  stripePublishableKey: string | null;
}) {
  const { purchases, liveListingPicklist, mockPromotionCheckout, stripePublishableKey } = props;
  const paidCount = purchases.filter((p) => p.status === PromotionPurchaseStatus.paid).length;

  return (
    <ListingsTabExpandSection
      className="mt-6"
      title="Promoted"
      titleClassName="text-violet-400/95"
      badgeCount={paidCount > 0 ? paidCount : undefined}
      blurb="Paid promotions"
    >
      {mockPromotionCheckout ? (
        <MockPromotionPayForm liveListingPicklist={liveListingPicklist} />
      ) : stripePublishableKey?.trim() ? (
        <PromotionCardPay
          stripePublishableKey={stripePublishableKey}
          liveListingPicklist={liveListingPicklist}
        />
      ) : (
        <p className="mt-3 text-xs text-zinc-500">Stripe is not configured for card entry on this environment.</p>
      )}

      <p className="mt-3 text-[11px] leading-snug text-zinc-600">
        Paying for promotion bumps you to the top of the list. As others purchase promotions, they will jump to the
        top. If your item / shop is falling too low in the list for your liking, sell more items or promote your
        shop/item again.
      </p>

      {purchases.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-zinc-800/90 pt-4">
          <li className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Promotions purchased
          </li>
          {purchases.map((p) => {
            const kindEnum = parsePromotionKind(p.kind) ?? PromotionKind.FRONT_PAGE_ITEM;
            const scope =
              promotionKindRequiresListing(kindEnum) && p.listingLabel
                ? ` — ${p.listingLabel}`
                : promotionKindRequiresListing(kindEnum)
                  ? " — listing"
                  : " — shop";
            return (
              <li
                key={p.id}
                className="rounded border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0">
                    <span className="font-medium text-zinc-200">{promotionKindLabel(kindEnum)}</span>
                    <span className="text-zinc-500">{scope}</span>
                    <div className="mt-0.5 text-[11px] leading-snug text-zinc-600">
                      {promotionKindSurfaceDescription(kindEnum)}
                    </div>
                  </span>
                  <span className="shrink-0 text-right text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    Promotion purchased
                    <span className="mt-0.5 flex items-baseline justify-end gap-2 text-[11px] font-normal normal-case tracking-normal text-zinc-500">
                      <span>
                        {p.status === PromotionPurchaseStatus.paid && p.paidAtIso ? (
                          <>{formatPaidDateMdYy(p.paidAtIso)}</>
                        ) : p.status === PromotionPurchaseStatus.pending ? (
                          <>Pending payment — started {formatWhen(p.createdAtIso)}</>
                        ) : (
                          <>
                            {p.status === PromotionPurchaseStatus.failed ? "Payment failed" : "Canceled"} —{" "}
                            {formatWhen(p.createdAtIso)}
                          </>
                        )}
                      </span>
                      <span className="tabular-nums text-zinc-600">{formatMoney(p.amountCents)}</span>
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[11px] text-zinc-600">No promotion purchases yet.</p>
      )}
    </ListingsTabExpandSection>
  );
}
