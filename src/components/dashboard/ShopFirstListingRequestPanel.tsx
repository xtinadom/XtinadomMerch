"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitFirstListingSetup, type ShopSetupActionResult } from "@/actions/dashboard-shop-setup";
import {
  encodeBaselinePickAllVariants,
  flattenShopBaselineCatalogGroups,
  type ShopSetupCatalogGroup,
} from "@/lib/shop-baseline-catalog";
import type { DraftListingRequestPrefillPayload } from "@/lib/shop-baseline-draft-prefill";

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

function listingProfitHint(priceDollarsStr: string, minPriceCents: number): string | null {
  const parsed = parseFloat(priceDollarsStr.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const cents = Math.round(parsed * 100);
  if (cents < minPriceCents) return null;
  if (cents === minPriceCents) return "Est. profit: $5";
  return "Est. profit: $5+";
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
  listingFeePolicySummary: string;
  r2Configured: boolean;
  listingPickerDiagnostics?: { adminCatalogItemCount: number };
  draftListingRequestPrefill?: DraftListingRequestPrefillPayload | null;
  embedded?: boolean;
}) {
  const {
    catalogGroups,
    listingFeePolicySummary,
    r2Configured,
    listingPickerDiagnostics,
    draftListingRequestPrefill = null,
    embedded,
  } = props;

  const router = useRouter();
  const [isListingPending, startListingTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [listingProductId, setListingProductId] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [variantListingPrices, setVariantListingPrices] = useState<Record<string, string>>({});
  const [listingRequestItemName, setListingRequestItemName] = useState("");
  const [listingHasFile, setListingHasFile] = useState(false);
  const [listingArtworkPreviewUrl, setListingArtworkPreviewUrl] = useState<string | null>(null);
  const [listingSavedFlash, setListingSavedFlash] = useState(false);
  const listingFileRef = useRef<HTMLInputElement>(null);
  const prefillAppliedListingIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    setListingSavedFlash(false);
  }, [variantListingPrices]);

  useEffect(() => {
    setVariantListingPrices((prev) => {
      const out: Record<string, string> = {};
      for (const g of catalogGroups) {
        if (g.kind !== "variants") continue;
        for (const v of g.variants) {
          const prior = prev[v.productId];
          out[v.productId] = prior !== undefined ? prior : (v.minPriceCents / 100).toFixed(2);
        }
      }
      return out;
    });
  }, [catalogGroups]);

  const selectionIsSingleItem = useMemo(
    () =>
      catalogGroups.some(
        (g) => g.kind === "single" && g.option.productId === listingProductId,
      ),
    [catalogGroups, listingProductId],
  );

  useEffect(() => {
    if (!listingProductId) {
      setListingPrice("");
      return;
    }
    const isSingle = catalogGroups.some(
      (g) => g.kind === "single" && g.option.productId === listingProductId,
    );
    if (!isSingle) return;
    const o = catalogOptions.find((x) => x.productId === listingProductId);
    if (!o) return;
    setListingPrice((prev) => {
      const t = prev.trim();
      if (!t) return (o.minPriceCents / 100).toFixed(2);
      const parsed = parseFloat(t.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed)) return (o.minPriceCents / 100).toFixed(2);
      if (Math.round(parsed * 100) < o.minPriceCents) return (o.minPriceCents / 100).toFixed(2);
      return prev;
    });
  }, [listingProductId, catalogOptions, catalogGroups]);

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
    if (p.variantPricesJson) {
      setVariantListingPrices((prev) => ({ ...prev, ...p.variantPricesJson! }));
    }
    setListingRequestItemName(p.requestItemName);
  }, [draftListingRequestPrefill, catalogGroups.length, listingProductId]);

  const listingPriceMeetsMinimum = useMemo(() => {
    if (!listingProductId) return false;
    if (selectionIsSingleItem) {
      const o = catalogOptions.find((x) => x.productId === listingProductId);
      if (!o) return false;
      const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed) || parsed <= 0) return false;
      return Math.round(parsed * 100) >= o.minPriceCents;
    }
    let variantGroup: Extract<ShopSetupCatalogGroup, { kind: "variants" }> | undefined;
    for (const g of catalogGroups) {
      if (g.kind !== "variants") continue;
      if (encodeBaselinePickAllVariants(g.itemId) === listingProductId) {
        variantGroup = g;
        break;
      }
    }
    if (!variantGroup) return false;
    for (const v of variantGroup.variants) {
      const str = variantListingPrices[v.productId] ?? "";
      const parsed = parseFloat(str.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed) || parsed <= 0) return false;
      if (Math.round(parsed * 100) < v.minPriceCents) return false;
    }
    return true;
  }, [
    listingProductId,
    selectionIsSingleItem,
    catalogOptions,
    listingPrice,
    catalogGroups,
    variantListingPrices,
  ]);

  async function handleListingSubmit(fd: FormData) {
    setMessage(null);
    startListingTransition(async () => {
      const r: ShopSetupActionResult = await submitFirstListingSetup(fd);
      if (r.ok) {
        setMessage({
          tone: "ok",
          text: "Listing submitted for review. Admin approval usually occurs in 1–3 days.",
        });
        setListingSavedFlash(true);
        window.setTimeout(() => setListingSavedFlash(false), 2500);
        setListingProductId("");
        setListingPrice("");
        setListingRequestItemName("");
        setVariantListingPrices({});
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
        <h3 className="text-base font-semibold text-zinc-100">Request a catalog listing</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          Choose one of the items the platform allows under <strong className="text-zinc-300">Admin → List</strong>{" "}
          (names, variants, example links, and minimum prices come straight from that list). Set your public price,
          upload <strong className="text-zinc-500">print‑ready</strong> artwork, then submit. Admin reviews before it
          goes live — usually <strong className="text-zinc-500">1–3 business days</strong>.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Uploads are stored as WebP for review and printing. Artwork must follow the{" "}
          <Link href="/shop-regulations" className="text-blue-400/90 underline">
            shop regulations
          </Link>
          . {listingFeePolicySummary} Pay from the Listings tab when your row appears if a fee applies.
        </p>
        {draftListingRequestPrefill ? (
          <p className="mt-2 rounded-lg border border-sky-900/40 bg-sky-950/20 px-3 py-2 text-xs text-sky-200/90">
            Your draft listing is selected below — confirm prices and upload artwork to submit for review.
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
                Admin → List has rows but none could be loaded as choices — ensure each variant has a name and a valid
                minimum price (or use item-level pricing when there are no variants).
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
            if (selectionIsSingleItem) {
              fd.set("listingPriceDollars", listingPrice);
            } else {
              for (const g of catalogGroups) {
                if (g.kind !== "variants") continue;
                if (encodeBaselinePickAllVariants(g.itemId) !== listingProductId) continue;
                const prices: Record<string, string> = {};
                for (const v of g.variants) {
                  prices[v.productId] = variantListingPrices[v.productId] ?? "";
                }
                fd.set("listingVariantPricesJson", JSON.stringify(prices));
                break;
              }
            }
            fd.set("requestItemName", listingRequestItemName.trim());
            const art = listingFileRef.current?.files?.[0];
            if (art) fd.set("listingArtwork", art);
            void handleListingSubmit(fd);
          }}
        >
          <div>
            <p className="text-xs font-medium text-zinc-400">Allowed items (Admin → List)</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
              Minimums are shown on each line. Select the main product name. If it has options (sizes, etc.), set a list
              price for every option — one submission is one listing and one admin approval; sizes are options on that
              item, not separate listings.
            </p>
            <ul
              className="mt-2 h-[350px] divide-y divide-zinc-800/80 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/40"
              role="listbox"
              aria-label="Items from admin catalog"
            >
              {catalogGroups.map((g) => {
                if (g.kind === "single") {
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
                      {selected ? (
                        <div className="border-t border-zinc-800/60 px-3 py-3 pl-10">
                          <label
                            className="block text-xs text-zinc-500"
                            htmlFor={`listing-price-${g.itemId}`}
                          >
                            Your list price (USD)
                          </label>
                          <input
                            id={`listing-price-${g.itemId}`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={listingPrice}
                            onChange={(e) => setListingPrice(e.target.value)}
                            onBlur={() => {
                              const minC = g.option.minPriceCents;
                              const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
                              if (!Number.isFinite(parsed) || Math.round(parsed * 100) < minC) {
                                setListingPrice((minC / 100).toFixed(2));
                              }
                            }}
                            className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
                          />
                          {(() => {
                            const h = listingProfitHint(listingPrice, g.option.minPriceCents);
                            return h ? (
                              <p className="mt-1.5 text-xs text-blue-400/90">{h}</p>
                            ) : null;
                          })()}
                        </div>
                      ) : null}
                    </li>
                  );
                }
                const variantMins = g.variants.map((v) => v.minPriceCents);
                const minLow = Math.min(...variantMins);
                const minHigh = Math.max(...variantMins);
                const minRangeLabel =
                  minLow === minHigh
                    ? formatUsdFromCents(minLow)
                    : `${formatUsdFromCents(minLow)} – ${formatUsdFromCents(minHigh)}`;
                const groupPick = encodeBaselinePickAllVariants(g.itemId);
                const groupSelected = listingProductId === groupPick;
                return (
                  <li key={g.itemId}>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm text-zinc-200">
                        <input
                          type="radio"
                          name="catalogProductPick"
                          value={groupPick}
                          checked={groupSelected}
                          onChange={() => setListingProductId(groupPick)}
                          className="shrink-0 border-zinc-600 bg-zinc-900 text-blue-600"
                        />
                        <span className="min-w-0 truncate font-medium">{g.itemName}</span>
                      </label>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500">Min {minRangeLabel}</span>
                      <span className="shrink-0 text-[11px] text-zinc-700">—</span>
                    </div>
                    <div className="divide-y divide-zinc-800/50 border-t border-zinc-800/60 py-1 pl-10 pr-3">
                      {g.variants.map((v) => {
                        const variantPriceStr = variantListingPrices[v.productId] ?? "";
                        const profitHint = listingProfitHint(variantPriceStr, v.minPriceCents);
                        return (
                          <div
                            key={v.productId}
                            className="flex flex-wrap items-end gap-3 py-2.5 sm:flex-nowrap"
                          >
                            <span className="min-w-[5rem] pb-2 text-sm text-zinc-300">{v.variantLabel}</span>
                            <span className="shrink-0 pb-2 text-xs tabular-nums text-zinc-500">
                              Min {formatUsdFromCents(v.minPriceCents)}
                            </span>
                            {groupSelected ? (
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-0.5 sm:max-w-[11rem]">
                                <label
                                  className="text-[10px] font-medium uppercase tracking-wide text-zinc-600"
                                  htmlFor={`variant-price-${v.productId}`}
                                >
                                  List price
                                </label>
                                <input
                                  id={`variant-price-${v.productId}`}
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  value={variantPriceStr}
                                  onChange={(e) =>
                                    setVariantListingPrices((prev) => ({
                                      ...prev,
                                      [v.productId]: e.target.value,
                                    }))
                                  }
                                  onBlur={() => {
                                    const raw = variantListingPrices[v.productId] ?? "";
                                    const parsed = parseFloat(raw.replace(/[^0-9.]/g, ""));
                                    const minC = v.minPriceCents;
                                    if (!Number.isFinite(parsed) || Math.round(parsed * 100) < minC) {
                                      setVariantListingPrices((prev) => ({
                                        ...prev,
                                        [v.productId]: (minC / 100).toFixed(2),
                                      }));
                                    }
                                  }}
                                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-100"
                                />
                                {profitHint ? (
                                  <p className="text-[11px] text-blue-400/90">{profitHint}</p>
                                ) : null}
                              </div>
                            ) : null}
                            {v.exampleHref ? (
                              <div className="flex shrink-0 items-center pb-2">
                                <CatalogExampleLink href={v.exampleHref} />
                              </div>
                            ) : (
                              <span className="shrink-0 pb-2 text-[11px] text-zinc-700">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-xs leading-relaxed text-zinc-600">
            List prices must meet each line’s minimum. Customers may add tips at checkout on eligible carts.
          </p>
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
    </div>
  );
}
