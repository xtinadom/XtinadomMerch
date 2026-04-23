"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitFirstListingSetup, type ShopSetupActionResult } from "@/actions/dashboard-shop-setup";
import { flattenShopBaselineCatalogGroups, type ShopSetupCatalogGroup } from "@/lib/shop-baseline-catalog";
import type { DraftListingRequestPrefillPayload } from "@/lib/shop-baseline-draft-prefill";
import { SHOP_LISTING_MAX_PRICE_CENTS, shopListingMaxPriceUsdLabel } from "@/lib/marketplace-constants";
import { expectedShopProfitMerchandiseUnitCents } from "@/lib/marketplace-fee";

const btnPrimary =
  "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed";
const btnPrimaryDisabled = "rounded-lg bg-zinc-900/50 px-4 py-2 text-sm font-medium text-zinc-500 ring-1 ring-zinc-800";
const btnPrimarySaving =
  "cursor-wait rounded-lg bg-zinc-100/70 px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300/60";
const btnPrimarySaved =
  "cursor-default rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-800/40";

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.max(0, cents) / 100);
}

function listingProfitHint(
  priceDollarsStr: string,
  minPriceCents: number,
  goodsServicesUnitCents: number,
): string | null {
  const parsed = parseFloat(priceDollarsStr.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const cents = Math.round(parsed * 100);
  if (cents < minPriceCents) return null;
  const profit = expectedShopProfitMerchandiseUnitCents({
    listPriceCents: cents,
    goodsServicesUnitCents,
  });
  return `Est. profit: ${formatUsdFromCents(profit)}`;
}

function CatalogExampleLink({ href }: { href: string }) {
  const className =
    "shrink-0 text-[11px] text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline";
  const external = /^https?:\/\//i.test(href);
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Open example reference"
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        Example
      </a>
    );
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open example reference"
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      Example
    </Link>
  );
}

export function ShopFirstListingRequestPanel(props: {
  catalogGroups: ShopSetupCatalogGroup[];
  r2Configured: boolean;
  listingPickerDiagnostics?: { adminCatalogItemCount: number };
  draftListingRequestPrefill?: DraftListingRequestPrefillPayload | null;
  /** When set (e.g. "$0.25"), the confirmation dialog requires a second checkbox for the publication fee. */
  publicationFeeLabel?: string | null;
  /** When a fee applies, Connect must be complete before this request can be submitted. */
  stripeConnectReadyForPaidListings?: boolean;
  embedded?: boolean;
}) {
  const {
    catalogGroups,
    r2Configured,
    listingPickerDiagnostics,
    draftListingRequestPrefill = null,
    publicationFeeLabel = null,
    stripeConnectReadyForPaidListings = true,
    embedded,
  } = props;

  const router = useRouter();
  const [isListingPending, startListingTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [listingProductId, setListingProductId] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingRequestItemName, setListingRequestItemName] = useState("");
  const [listingHasFile, setListingHasFile] = useState(false);
  const [listingArtworkPreviewUrl, setListingArtworkPreviewUrl] = useState<string | null>(null);
  const [listingSavedFlash, setListingSavedFlash] = useState(false);
  const listingFileRef = useRef<HTMLInputElement>(null);
  const prefillAppliedListingIdRef = useRef<string | null>(null);
  const pendingListingFdRef = useRef<FormData | null>(null);
  const [attestationOpen, setAttestationOpen] = useState(false);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [feeChargeConsentChecked, setFeeChargeConsentChecked] = useState(false);

  useEffect(() => {
    if (attestationOpen) {
      setAttestationChecked(false);
      setFeeChargeConsentChecked(false);
    }
  }, [attestationOpen]);

  const publicationFeeConsentRequired = Boolean(publicationFeeLabel?.trim());
  const feeConsentOk = !publicationFeeConsentRequired || feeChargeConsentChecked;

  const catalogOptions = useMemo(
    () => flattenShopBaselineCatalogGroups(catalogGroups),
    [catalogGroups],
  );

  useEffect(() => {
    if (!listingArtworkPreviewUrl) return;
    return () => {
      URL.revokeObjectURL(listingArtworkPreviewUrl);
    };
  }, [listingArtworkPreviewUrl]);

  useEffect(() => {
    if (listingProductId || listingPrice || listingRequestItemName || listingHasFile) {
      setListingSavedFlash(false);
    }
  }, [listingProductId, listingPrice, listingRequestItemName, listingHasFile]);

  const selectedCatalogGroup = useMemo(() => {
    for (const g of catalogGroups) {
      if (g.option.productId === listingProductId) return g;
    }
    return null;
  }, [catalogGroups, listingProductId]);

  useEffect(() => {
    if (!listingProductId) {
      setListingPrice("");
      return;
    }
    const o = catalogOptions.find((x) => x.productId === listingProductId);
    if (!o) return;
    setListingPrice((prev) => {
      const t = prev.trim();
      if (!t) return (o.minPriceCents / 100).toFixed(2);
      const parsed = parseFloat(t.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed)) return (o.minPriceCents / 100).toFixed(2);
      const cents = Math.round(parsed * 100);
      if (cents < o.minPriceCents) return (o.minPriceCents / 100).toFixed(2);
      if (cents > SHOP_LISTING_MAX_PRICE_CENTS) return (SHOP_LISTING_MAX_PRICE_CENTS / 100).toFixed(2);
      return prev;
    });
  }, [listingProductId, catalogOptions]);

  useEffect(() => {
    if (!draftListingRequestPrefill) {
      prefillAppliedListingIdRef.current = null;
    }
  }, [draftListingRequestPrefill]);

  useEffect(() => {
    if (!draftListingRequestPrefill || catalogGroups.length === 0) return;
    if (prefillAppliedListingIdRef.current === draftListingRequestPrefill.listingId) return;
    prefillAppliedListingIdRef.current = draftListingRequestPrefill.listingId;
    setListingProductId(draftListingRequestPrefill.catalogProductPick);
  }, [draftListingRequestPrefill, catalogGroups.length]);

  useEffect(() => {
    const p = draftListingRequestPrefill;
    if (!p || catalogGroups.length === 0) return;
    if (prefillAppliedListingIdRef.current !== p.listingId) return;
    if (listingProductId !== p.catalogProductPick) return;
    if (p.listingPriceDollars != null) {
      setListingPrice(p.listingPriceDollars);
    }
    setListingRequestItemName(p.requestItemName);
  }, [draftListingRequestPrefill, catalogGroups.length, listingProductId]);

  const listingPriceMeetsMinimum = useMemo(() => {
    if (!listingProductId) return false;
    const o = catalogOptions.find((x) => x.productId === listingProductId);
    if (!o) return false;
    const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return false;
    const cents = Math.round(parsed * 100);
    return cents >= o.minPriceCents && cents <= SHOP_LISTING_MAX_PRICE_CENTS;
  }, [listingProductId, catalogOptions, listingPrice]);

  async function handleListingSubmit(fd: FormData) {
    setMessage(null);
    startListingTransition(async () => {
      const r: ShopSetupActionResult = await submitFirstListingSetup(fd);
      if (r.ok) {
        setMessage({
          tone: "ok",
          text:
            r.message ??
            "Listing submitted for review. Admin approval usually occurs in 1–3 days.",
        });
        setListingSavedFlash(true);
        window.setTimeout(() => setListingSavedFlash(false), 2500);
        setListingProductId("");
        setListingPrice("");
        setListingRequestItemName("");
        setListingHasFile(false);
        setListingArtworkPreviewUrl(null);
        if (listingFileRef.current) listingFileRef.current.value = "";
        router.refresh();
      } else {
        setMessage({ tone: "err", text: r.error });
      }
    });
  }

  const listingRequestItemNameOk = listingRequestItemName.trim().length > 0;
  const listingCanSubmit =
    Boolean(listingProductId) &&
    listingPriceMeetsMinimum &&
    listingRequestItemNameOk &&
    listingHasFile;
  const listingSubmitSubmittedFlash =
    listingSavedFlash && !listingCanSubmit && !isListingPending;
  const listingBtnClass = isListingPending
    ? btnPrimarySaving
    : !listingCanSubmit
      ? listingSavedFlash
        ? btnPrimarySaved
        : btnPrimaryDisabled
      : btnPrimary;

  return (
    <div
      className={`space-y-4 text-sm text-zinc-300 ${embedded ? "" : "rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6"}`}
    >
      <div>
        <h3 className="text-base font-semibold text-zinc-100">Request a product listing</h3>
        {draftListingRequestPrefill ? (
          <p className="mt-2 rounded-lg border border-sky-900/40 bg-sky-950/20 px-3 py-2 text-xs text-sky-200/90">
            Your draft listing is selected below — confirm prices and upload artwork to submit for review.
          </p>
        ) : null}
        {publicationFeeConsentRequired && !stripeConnectReadyForPaidListings ? (
          <p className="mt-2 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
            This listing has a publication fee. Finish{" "}
            <Link href="/dashboard?dash=setup" className="text-amber-100 underline-offset-2 hover:underline">
              Stripe Connect
            </Link>{" "}
            on the Onboarding tab (charges and payouts enabled) before you can submit — you will also see a notice in
            your Notifications tab.
          </p>
        ) : null}
      </div>

      {catalogGroups.length === 0 ? (
        <p className="text-xs text-amber-200/80">
          <strong className="text-amber-100/90">No items to add yet.</strong>{" "}
          {listingPickerDiagnostics ? (
            listingPickerDiagnostics.adminCatalogItemCount === 0 ? (
              <>
                The allowed-items list under <strong className="font-medium text-amber-100/90">Admin → List</strong> has
                no rows yet — add items there first.
              </>
            ) : (
              <>
                Admin → List has rows but none could be loaded as choices — ensure each item has a valid minimum price.
              </>
            )
          ) : (
            <>
              The allowed-items list under <strong className="font-medium text-amber-100/90">Admin → List</strong> is
              empty or unavailable.
            </>
          )}{" "}
          Refresh this page after updating the list.
        </p>
      ) : !r2Configured ? (
        <p className="text-xs text-amber-200/80">
          R2 uploads are not configured — artwork upload is unavailable until the operator sets R2 keys.
        </p>
      ) : (
        <form
          className="space-y-4"
          encType="multipart/form-data"
          onSubmit={(e) => {
            e.preventDefault();
            if (!listingCanSubmit || isListingPending) return;
            const fd = new FormData();
            fd.set("productId", listingProductId);
            fd.set("listingPriceDollars", listingPrice);
            fd.set("requestItemName", listingRequestItemName.trim());
            const art = listingFileRef.current?.files?.[0];
            if (art) fd.set("listingArtwork", art);
            pendingListingFdRef.current = fd;
            setAttestationOpen(true);
          }}
        >
          <div>
            <p className="text-xs font-medium text-zinc-400">Item Catalogue</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
              Select a base item your design will be printed on.
            </p>
            <ul
              className="mt-2 h-[350px] divide-y divide-zinc-800/80 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/40"
              role="listbox"
              aria-label="Items from admin catalog"
            >
              {catalogGroups.map((g) => {
                const selected = listingProductId === g.option.productId;
                return (
                  <li key={g.itemId}>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm text-zinc-200">
                        <input
                          type="radio"
                          name="catalogProductPick"
                          value={g.option.productId}
                          checked={selected}
                          onChange={() => setListingProductId(g.option.productId)}
                          className="shrink-0 border-zinc-600 bg-zinc-900 text-blue-600"
                        />
                        <span className="min-w-0 truncate">{g.itemName}</span>
                      </label>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                        Min {formatUsdFromCents(g.option.minPriceCents)}
                      </span>
                      {g.option.exampleHref ? (
                        <CatalogExampleLink href={g.option.exampleHref} />
                      ) : (
                        <span className="shrink-0 text-[11px] text-zinc-700">—</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <label className="block text-xs text-zinc-500" htmlFor="listing-request-item-name">
            Name item
            <input
              id="listing-request-item-name"
              name="requestItemName"
              type="text"
              autoComplete="off"
              maxLength={120}
              value={listingRequestItemName}
              onChange={(e) => setListingRequestItemName(e.target.value)}
              placeholder="What you call this design or product"
              className="mt-1 block w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </label>
          {selectedCatalogGroup ? (
            <div>
              <label
                className="block text-xs text-zinc-500"
                htmlFor={`listing-price-${selectedCatalogGroup.itemId}`}
              >
                Your list price (USD)
              </label>
              <input
                id={`listing-price-${selectedCatalogGroup.itemId}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
                onBlur={() => {
                  const minC = selectedCatalogGroup.option.minPriceCents;
                  const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
                  let cents = Number.isFinite(parsed) ? Math.round(parsed * 100) : minC;
                  if (cents < minC) cents = minC;
                  if (cents > SHOP_LISTING_MAX_PRICE_CENTS) cents = SHOP_LISTING_MAX_PRICE_CENTS;
                  setListingPrice((cents / 100).toFixed(2));
                }}
                className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
              />
              {(() => {
                const h = listingProfitHint(
                  listingPrice,
                  selectedCatalogGroup.option.minPriceCents,
                  selectedCatalogGroup.option.goodsServicesCostCents,
                );
                return h ? <p className="mt-1.5 text-xs text-blue-400/90">{h}</p> : null;
              })()}
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                List prices must meet each line’s minimum and cannot exceed {shopListingMaxPriceUsdLabel()} per option.
                Customers may add tips at checkout on eligible carts.
              </p>
            </div>
          ) : null}
          <label className="block text-xs text-zinc-500">
            Artwork file (PNG or JPEG recommended)
            <input
              ref={listingFileRef}
              type="file"
              name="listingArtwork"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setListingHasFile(Boolean(file));
                if (file && file.type.startsWith("image/")) {
                  setListingArtworkPreviewUrl(URL.createObjectURL(file));
                } else {
                  setListingArtworkPreviewUrl(null);
                }
              }}
              className="mt-1 block w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
            />
            {message ? (
              <p
                className={
                  message.tone === "ok"
                    ? "mt-2 rounded-lg border border-emerald-900/50 bg-emerald-950/25 px-3 py-2 text-xs text-emerald-200/90"
                    : "mt-2 rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90"
                }
                role="status"
              >
                {message.text}
              </p>
            ) : null}
            {listingArtworkPreviewUrl ? (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">Preview</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img
                  src={listingArtworkPreviewUrl}
                  alt=""
                  className="max-h-40 max-w-full rounded-lg border border-zinc-700 bg-zinc-900 object-contain"
                />
              </div>
            ) : null}
          </label>
          <button
            type="submit"
            disabled={!listingCanSubmit || isListingPending}
            className={`inline-flex min-h-[2.5rem] items-center justify-center gap-2 ${listingBtnClass}`}
            aria-busy={isListingPending}
          >
            {isListingPending ? (
              <>
                <span
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-zinc-500/80 border-t-zinc-950"
                  aria-hidden
                />
                <span>Submitting…</span>
              </>
            ) : listingSubmitSubmittedFlash ? (
              <>
                <svg
                  className="size-4 shrink-0 text-emerald-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-7.5 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 6.848-9.817a.75.75 0 011.051-.143z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Submitted</span>
              </>
            ) : (
              <span>Submit for admin review</span>
            )}
          </button>
        </form>
      )}

      {attestationOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="listing-attestation-title"
        >
          <div className="max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl">
            <h3 id="listing-attestation-title" className="text-base font-semibold text-zinc-100">
              Confirm listing request
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Submitting sends your artwork for admin review. Please confirm the statements below.
            </p>
            <label className="mt-4 flex cursor-pointer gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={attestationChecked}
                onChange={(e) => setAttestationChecked(e.target.checked)}
                className="mt-1 shrink-0 rounded border-zinc-600"
              />
              <span>
                I have the rights to the photo / artwork I am uploading, and it follows the{" "}
                <Link
                  href="/dashboard?dash=itemGuidelines"
                  className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  item guidelines
                </Link>
                .
              </span>
            </label>
            {publicationFeeConsentRequired ? (
              <label className="mt-3 flex cursor-pointer gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={feeChargeConsentChecked}
                  onChange={(e) => setFeeChargeConsentChecked(e.target.checked)}
                  className="mt-1 shrink-0 rounded border-zinc-600"
                />
                <span>
                  I agree to be charged {(publicationFeeLabel ?? "").trim()} for this listing.
                </span>
              </label>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
                onClick={() => {
                  setAttestationOpen(false);
                  pendingListingFdRef.current = null;
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!attestationChecked || !feeConsentOk || isListingPending}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  const fd = pendingListingFdRef.current;
                  if (!fd || !attestationChecked || !feeConsentOk) return;
                  fd.set("guidelinesAttestation", "1");
                  if (publicationFeeConsentRequired) {
                    fd.set("feeChargeAttestation", "1");
                  }
                  setAttestationOpen(false);
                  pendingListingFdRef.current = null;
                  void handleListingSubmit(fd);
                }}
              >
                Submit for admin review
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
