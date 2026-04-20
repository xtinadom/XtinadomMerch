"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import type { Prisma } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import {
  dashboardClearListingSupplementPhoto,
  dashboardSetListingStorefrontCatalogImagesForm,
  dashboardSubmitListingRequest,
  dashboardUpdateListingItemName,
  dashboardUpdateListingPrice,
  dashboardUpdateListingVariantPrices,
  dashboardUploadListingSupplementPhoto,
  type DashboardSubmitListingRequestResult,
  type ListingCatalogImagesFormState,
} from "@/actions/dashboard-marketplace";
import {
  parseListingPrintifyVariantPrices,
} from "@/lib/listing-printify-variant-prices";
import { printifyVariantShopFloorCents } from "@/lib/listing-cart-price";
import { shopListingMaxPriceUsdLabel } from "@/lib/marketplace-constants";
import { expectedShopProfitMerchandiseUnitCents } from "@/lib/marketplace-fee";
import { getPrintifyVariantsForProduct } from "@/lib/printify-variants";

const REQUEST_ITEM_NAME_MAX = 120;

const disabledSave =
  "cursor-not-allowed rounded bg-zinc-900/50 px-3 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-800";
const activeSave =
  "rounded bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700";
const savingSave =
  "cursor-wait rounded bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-300";
const savedSave =
  "cursor-default rounded border border-emerald-900/40 bg-zinc-900/50 px-3 py-1 text-xs font-medium text-emerald-300/90";

function effectiveItemDisplayName(
  requestItemName: string | null | undefined,
  catalogProductName: string,
): string {
  const custom = requestItemName?.trim();
  return custom || catalogProductName;
}

type ItemNameFormProps = {
  listingId: string;
  catalogProductName: string;
  requestItemName: string | null;
  /** Rejected, creator-removed, or awaiting admin review (submitted / images ok / printify step). */
  readOnly?: boolean;
};

export function DashboardListingItemNameForm({
  listingId,
  catalogProductName,
  requestItemName,
  readOnly = false,
}: ItemNameFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = effectiveItemDisplayName(requestItemName, catalogProductName);
  const [name, setName] = useState(initial);
  const baseline = useRef(initial);
  const [savedFlash, setSavedFlash] = useState(false);

  useLayoutEffect(() => {
    const next = effectiveItemDisplayName(requestItemName, catalogProductName);
    setName(next);
    baseline.current = next;
  }, [listingId, catalogProductName, requestItemName]);

  useLayoutEffect(() => {
    setSavedFlash(false);
  }, [listingId]);

  const dirty = name.trim() !== baseline.current.trim();

  useEffect(() => {
    if (dirty) setSavedFlash(false);
  }, [dirty]);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!dirty || pending) return;
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const r = await dashboardUpdateListingItemName(fd);
        router.refresh();
        if (r.ok) {
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 2500);
        }
      });
    },
    [dirty, pending, router],
  );

  const label = pending ? "Saving..." : savedFlash && !dirty ? "Saved" : "Save name";
  const btnClass = pending
    ? savingSave
    : !dirty
      ? savedFlash
        ? savedSave
        : disabledSave
      : activeSave;

  if (readOnly) {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-500">Item name</p>
        <p className="mt-1 text-sm font-medium text-zinc-200">{initial}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="min-w-0 flex-1 flex flex-wrap items-end gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <label className="min-w-0 flex-1 text-xs text-zinc-500">
        Item name
        <input
          type="text"
          name="requestItemName"
          value={name}
          maxLength={REQUEST_ITEM_NAME_MAX}
          autoComplete="off"
          onChange={(ev) => setName(ev.target.value)}
          className="mt-1 block w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm font-medium text-zinc-100"
        />
      </label>
      <button type="submit" disabled={!dirty || pending} className={`${btnClass} shrink-0`}>
        {label}
      </button>
    </form>
  );
}

type PriceFormProps = {
  listingId: string;
  priceDollarsFormatted: string;
  listingPriceCents: number;
  listingPrintifyVariantPrices: unknown;
  /** Per Printify variant id — unit goods/services COGS from admin baseline (same split as orders Shop Profit). */
  goodsServicesUnitCentsByPrintifyVariantId?: Record<string, number>;
  product: {
    fulfillmentType: FulfillmentType;
    priceCents: number;
    minPriceCents: number;
    printifyVariantId: string | null;
    printifyVariants: Prisma.JsonValue | null;
  };
  readOnly?: boolean;
};

/** Stable JSON for comparing variant price maps (key order independent). */
function variantDollarsStableKey(obj: Record<string, string>): string {
  const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const sorted: Record<string, string> = {};
  for (const k of keys) sorted[k] = obj[k] ?? "";
  return JSON.stringify(sorted);
}

function printifyListingIntentHint(
  _product: PriceFormProps["product"],
  eachOptionSentence: boolean,
): ReactNode {
  return (
    <p className="text-[11px] leading-relaxed text-zinc-600">
      This is one listing in your shop for this item. Printify options (such as size) are part of this same listing,
      not separate products.
      {eachOptionSentence ? " Set your price for each option below." : null}
    </p>
  );
}

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.max(0, cents) / 100);
}

function listingEstProfitLine(
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

function initialVariantDollarsById(
  listingPriceCents: number,
  listingPrintifyVariantPrices: unknown,
  product: PriceFormProps["product"],
): Record<string, string> | null {
  const variants = getPrintifyVariantsForProduct(product);
  if (variants.length <= 1) return null;
  const map = parseListingPrintifyVariantPrices(listingPrintifyVariantPrices);
  const out: Record<string, string> = {};
  for (const v of variants) {
    const c = map?.[v.id] ?? listingPriceCents;
    out[v.id] = (c / 100).toFixed(2);
  }
  return out;
}

export function DashboardListingPriceForm({
  listingId,
  priceDollarsFormatted,
  listingPriceCents,
  listingPrintifyVariantPrices,
  goodsServicesUnitCentsByPrintifyVariantId = {},
  product,
  readOnly = false,
}: PriceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(priceDollarsFormatted);
  const baseline = useRef(priceDollarsFormatted);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const printifyVariants = getPrintifyVariantsForProduct(product);
  const multiVariantPricing = printifyVariants.length > 1;

  const [variantDollars, setVariantDollars] = useState<Record<string, string>>(() =>
    initialVariantDollarsById(listingPriceCents, listingPrintifyVariantPrices, product) ?? {},
  );
  const variantBaseline = useRef<Record<string, string>>(
    initialVariantDollarsById(listingPriceCents, listingPrintifyVariantPrices, product) ?? {},
  );

  const catalogVariantsSyncKey = JSON.stringify(product.printifyVariants ?? null);
  const savedVariantPricesKey = JSON.stringify(listingPrintifyVariantPrices ?? null);

  useLayoutEffect(() => {
    setPrice(priceDollarsFormatted);
    baseline.current = priceDollarsFormatted;
  }, [listingId, priceDollarsFormatted]);

  useLayoutEffect(() => {
    const next =
      initialVariantDollarsById(listingPriceCents, listingPrintifyVariantPrices, product) ?? {};
    setVariantDollars(next);
    variantBaseline.current = { ...next };
  }, [
    listingId,
    listingPriceCents,
    savedVariantPricesKey,
    catalogVariantsSyncKey,
    product.fulfillmentType,
    product.printifyVariantId,
  ]);

  useLayoutEffect(() => {
    setSavedFlash(false);
    setSaveError(null);
  }, [listingId]);

  const dirtySingle = price.trim() !== baseline.current.trim();
  const dirtyMulti =
    multiVariantPricing &&
    variantDollarsStableKey(variantDollars) !== variantDollarsStableKey(variantBaseline.current);
  const dirty = multiVariantPricing ? dirtyMulti : dirtySingle;

  useEffect(() => {
    if (dirty) setSavedFlash(false);
  }, [dirty]);

  const onSubmitSingle = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!dirtySingle || pending || multiVariantPricing) return;
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const r = await dashboardUpdateListingPrice(fd);
        if (r.ok) {
          setSaveError(null);
          router.refresh();
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 2500);
        } else {
          setSaveError(r.error);
        }
      });
    },
    [dirtySingle, pending, router, multiVariantPricing],
  );

  const onSubmitMulti = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!dirtyMulti || pending) return;
      const fd = new FormData();
      fd.set("listingId", listingId);
      fd.set("variantPricesJson", JSON.stringify(variantDollars));
      startTransition(async () => {
        const r = await dashboardUpdateListingVariantPrices(fd);
        if (r.ok) {
          setSaveError(null);
          router.refresh();
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 2500);
        } else {
          setSaveError(r.error);
        }
      });
    },
    [dirtyMulti, pending, listingId, variantDollars, router],
  );

  const label = pending ? "Saving..." : savedFlash && !dirty ? "Saved" : multiVariantPricing ? "Save prices" : "Save price";
  const btnClass = pending
    ? savingSave
    : !dirty
      ? savedFlash
        ? savedSave
        : disabledSave
      : activeSave;

  if (readOnly && multiVariantPricing) {
    return (
      <div className="mt-3 space-y-2">
        {printifyListingIntentHint(product, true)}
        <p className="text-xs text-zinc-500">Your price (USD)</p>
        {printifyVariants.map((v) => {
          const cents =
            parseListingPrintifyVariantPrices(listingPrintifyVariantPrices)?.[v.id] ??
            listingPriceCents;
          const floor = printifyVariantShopFloorCents(product, v.priceCents);
          const gs = goodsServicesUnitCentsByPrintifyVariantId[v.id] ?? 0;
          const profitLine = listingEstProfitLine((cents / 100).toFixed(2), floor, gs);
          return (
            <div key={v.id} className="space-y-0.5">
              <p className="text-sm text-zinc-200">
                <span className="text-zinc-500">{v.title}: </span>
                <span className="font-mono">{(cents / 100).toFixed(2)}</span>
              </p>
              {profitLine ? (
                <p className="text-[11px] text-blue-400/90">{profitLine}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (readOnly) {
    const vs = printifyVariants;
    const floor =
      vs.length === 0
        ? product.minPriceCents > 0
          ? product.minPriceCents
          : product.priceCents
        : printifyVariantShopFloorCents(product, vs[0]!.priceCents);
    const vid = vs[0]?.id;
    const gs = vid != null ? (goodsServicesUnitCentsByPrintifyVariantId[vid] ?? 0) : 0;
    const profitLine = listingEstProfitLine(price, floor, gs);
    return (
      <div className="mt-3">
        {printifyListingIntentHint(product, false)}
        <p className="text-xs text-zinc-500">Your price (USD)</p>
        <p className="mt-1 font-mono text-sm text-zinc-200">{price}</p>
        {profitLine ? <p className="mt-1 text-[11px] text-blue-400/90">{profitLine}</p> : null}
      </div>
    );
  }

  if (multiVariantPricing) {
    return (
      <form onSubmit={onSubmitMulti} className="mt-3 space-y-3">
        <input type="hidden" name="listingId" value={listingId} />
        {printifyListingIntentHint(product, true)}
        <p className="text-[11px] text-zinc-600">Maximum {shopListingMaxPriceUsdLabel()} per option.</p>
        <p className="text-xs text-zinc-500">Your price (USD) — each option</p>
        <ul className="space-y-2">
          {printifyVariants.map((v) => {
            const floor = printifyVariantShopFloorCents(product, v.priceCents);
            const gs = goodsServicesUnitCentsByPrintifyVariantId[v.id] ?? 0;
            const profitLine = listingEstProfitLine(variantDollars[v.id] ?? "", floor, gs);
            return (
              <li key={v.id} className="space-y-0.5">
                <label className="block min-w-0 max-w-[10rem] text-xs text-zinc-500">
                  <span className="text-zinc-400">{v.title}</span>
                  <input
                    type="text"
                    value={variantDollars[v.id] ?? ""}
                    autoComplete="off"
                    onChange={(ev) => {
                      setSaveError(null);
                      setVariantDollars((s) => ({ ...s, [v.id]: ev.target.value }));
                    }}
                    className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-sm text-zinc-200"
                  />
                </label>
                {profitLine ? (
                  <p className="text-[11px] text-blue-400/90">{profitLine}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {saveError ? (
          <p className="text-xs leading-snug text-red-300/90" role="alert">
            {saveError}
          </p>
        ) : null}
        <button type="submit" disabled={!dirty || pending} className={btnClass}>
          {label}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmitSingle} className="mt-3 space-y-2">
      {printifyListingIntentHint(product, false)}
      <p className="text-[11px] text-zinc-600">Maximum list price {shopListingMaxPriceUsdLabel()} per listing.</p>
      <div className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <label className="text-xs text-zinc-500">
        Your price (USD)
        <input
          type="text"
          name="priceDollars"
          value={price}
          onChange={(ev) => {
            setSaveError(null);
            setPrice(ev.target.value);
          }}
          className="ml-2 w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-200"
        />
      </label>
      <button type="submit" disabled={!dirty || pending} className={btnClass}>
        {label}
      </button>
      </div>
      {(() => {
        const vs = printifyVariants;
        const floor =
          vs.length === 0
            ? product.minPriceCents > 0
              ? product.minPriceCents
              : product.priceCents
            : printifyVariantShopFloorCents(product, vs[0]!.priceCents);
        const vid = vs[0]?.id;
        const gs = vid != null ? (goodsServicesUnitCentsByPrintifyVariantId[vid] ?? 0) : 0;
        const profitLine = listingEstProfitLine(price, floor, gs);
        return profitLine ? (
          <p className="text-[11px] text-blue-400/90">{profitLine}</p>
        ) : null;
      })()}
      {saveError ? (
        <p className="text-xs leading-snug text-red-300/90" role="alert">
          {saveError}
        </p>
      ) : null}
    </form>
  );
}

type SubmitRequestFormProps = {
  listingId: string;
  defaultImageUrlsText: string;
  /** When true, publication fee is required before submit (server also enforces). */
  feeBlocksSubmit?: boolean;
  paidListingFeeLabel?: string;
  /** When true, confirm publication fee in the dialog (slot charges after free listings). */
  listingFeeChargeConsentRequired?: boolean;
};

export function DashboardSubmitListingRequestForm({
  listingId,
  defaultImageUrlsText,
  feeBlocksSubmit = false,
  paidListingFeeLabel = "",
  listingFeeChargeConsentRequired = false,
}: SubmitRequestFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(defaultImageUrlsText);
  const [savedFlash, setSavedFlash] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attestationOpen, setAttestationOpen] = useState(false);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [feeChargeConsentChecked, setFeeChargeConsentChecked] = useState(false);
  const pendingFdRef = useRef<FormData | null>(null);

  useLayoutEffect(() => {
    setText(defaultImageUrlsText);
    setSavedFlash(false);
    setSubmitError(null);
  }, [listingId, defaultImageUrlsText]);

  useEffect(() => {
    if (attestationOpen) {
      setAttestationChecked(false);
      setFeeChargeConsentChecked(false);
    }
  }, [attestationOpen]);

  const feeConsentOk = !listingFeeChargeConsentRequired || feeChargeConsentChecked;

  const hasUrls = text.trim().length > 0;

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!hasUrls || pending || feeBlocksSubmit) return;
      const fd = new FormData(e.currentTarget);
      pendingFdRef.current = fd;
      setAttestationOpen(true);
    },
    [hasUrls, pending, feeBlocksSubmit],
  );

  const label = pending
    ? "Saving..."
    : savedFlash
      ? "Saved"
      : "Submit for admin approval";
  const btnClass = pending
    ? savingSave
    : !hasUrls
      ? disabledSave
      : savedFlash
        ? savedSave
        : activeSave;

  return (
    <>
      <form onSubmit={onSubmit} className="mt-4 space-y-2">
        <input type="hidden" name="listingId" value={listingId} />
        <label className="block text-xs text-zinc-500">
          Reference image URLs (one per line) for admin review
          <textarea
            name="requestImageUrls"
            rows={3}
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200"
          />
        </label>
        <button
          type="submit"
          disabled={!hasUrls || pending || savedFlash || feeBlocksSubmit}
          className={btnClass}
        >
          {label}
        </button>
      </form>

      {feeBlocksSubmit ? (
        <p className="mt-2 text-xs leading-snug text-amber-200/85" role="status">
          Pay the
          {paidListingFeeLabel.trim() ? ` ${paidListingFeeLabel.trim()} ` : " "}
          publication fee above before you can submit for admin review.
        </p>
      ) : null}
      {submitError ? (
        <p className="mt-2 text-xs leading-snug text-red-300/90" role="alert">
          {submitError}
        </p>
      ) : null}

      {attestationOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dash-listing-attestation-title"
        >
          <div className="max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl">
            <h3 id="dash-listing-attestation-title" className="text-base font-semibold text-zinc-100">
              Confirm listing request
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              You are about to submit these reference URLs for admin review.
            </p>
            <label className="mt-4 flex cursor-pointer gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={attestationChecked}
                onChange={(e) => setAttestationChecked(e.target.checked)}
                className="mt-1 shrink-0 rounded border-zinc-600"
              />
              <span>
                I have the rights to the photos referenced above, and they follow the{" "}
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
            {listingFeeChargeConsentRequired && paidListingFeeLabel.trim() ? (
              <label className="mt-3 flex cursor-pointer gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={feeChargeConsentChecked}
                  onChange={(e) => setFeeChargeConsentChecked(e.target.checked)}
                  className="mt-1 shrink-0 rounded border-zinc-600"
                />
                <span>
                  I agree to be charged {paidListingFeeLabel.trim()} for this listing.
                </span>
              </label>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
                onClick={() => {
                  setAttestationOpen(false);
                  pendingFdRef.current = null;
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!attestationChecked || !feeConsentOk || pending || feeBlocksSubmit}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  const fd = pendingFdRef.current;
                  if (!fd || !attestationChecked || !feeConsentOk || feeBlocksSubmit) return;
                  fd.set("guidelinesAttestation", "1");
                  if (listingFeeChargeConsentRequired) {
                    fd.set("feeChargeAttestation", "1");
                  }
                  setAttestationOpen(false);
                  pendingFdRef.current = null;
                  startTransition(async () => {
                    const r: DashboardSubmitListingRequestResult =
                      await dashboardSubmitListingRequest(fd);
                    router.refresh();
                    if (r.ok) {
                      setSubmitError(null);
                      setSavedFlash(true);
                      window.setTimeout(() => setSavedFlash(false), 2500);
                    } else {
                      setSubmitError(r.error ?? "Could not submit for review. Try again.");
                    }
                  });
                }}
              >
                Submit for admin approval
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type SupplementPhotoFormProps = {
  listingId: string;
  ownerSupplementImageUrl: string | null;
  r2Configured: boolean;
  /** When false, show current image only (e.g. admin-frozen listing). */
  canEdit: boolean;
};

export function DashboardListingSupplementPhotoForm({
  listingId,
  ownerSupplementImageUrl,
  r2Configured,
  canEdit,
}: SupplementPhotoFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    setMessage(null);
    setHasFile(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [listingId, ownerSupplementImageUrl]);

  const uploadLabel = pending ? "Uploading…" : "Upload extra photo";
  const uploadClass = pending
    ? savingSave
    : !hasFile
      ? disabledSave
      : activeSave;

  return (
    <div className="mt-4 border-t border-zinc-800 pt-4">
      <p className="text-xs font-medium text-zinc-500">Extra storefront photo (optional)</p>
      <p className="mt-1 text-[11px] text-zinc-600">
        One image per listing, compressed to about 100 KiB. It is added after the main product
        images from the catalog and platform admin. You cannot remove or replace those images here.
      </p>
      {ownerSupplementImageUrl ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ownerSupplementImageUrl}
            alt=""
            className="h-20 w-20 rounded border border-zinc-700 object-cover"
          />
          {canEdit ? (
            <form
              className="inline"
              onSubmit={(e) => {
                e.preventDefault();
                if (pending) return;
                const fd = new FormData();
                fd.set("listingId", listingId);
                startTransition(async () => {
                  setMessage(null);
                  const r = await dashboardClearListingSupplementPhoto(fd);
                  router.refresh();
                  if (!r.ok) setMessage(r.error);
                });
              }}
            >
              <button
                type="submit"
                disabled={pending}
                className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              >
                Remove only this extra photo
              </button>
            </form>
          ) : (
            <p className="text-[11px] text-zinc-600">Uploads disabled while this listing is frozen.</p>
          )}
        </div>
      ) : null}
      {!canEdit ? null : !r2Configured ? (
        <p className="mt-2 text-xs text-amber-200/80">
          R2 uploads are not configured on this server — contact the platform operator.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setHasFile(Boolean(e.target.files?.length))}
            className="max-w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
          />
          <button
            type="button"
            disabled={!hasFile || pending}
            className={uploadClass}
            onClick={() => {
              const file = fileRef.current?.files?.[0];
              if (!file || pending) return;
              const fd = new FormData();
              fd.set("listingId", listingId);
              fd.set("supplementPhoto", file);
              startTransition(async () => {
                setMessage(null);
                const r = await dashboardUploadListingSupplementPhoto(fd);
                router.refresh();
                if (!r.ok) setMessage(r.error);
                else if (fileRef.current) fileRef.current.value = "";
                if (r.ok) setHasFile(false);
              });
            }}
          >
            {uploadLabel}
          </button>
        </div>
      )}
      {message ? <p className="mt-2 text-xs text-red-300/90">{message}</p> : null}
    </div>
  );
}

const initialCatalogImagesForm: ListingCatalogImagesFormState = {
  ok: false,
  error: null,
};

export function ListingStorefrontCatalogImagesForms({
  listingId,
  catalogUrls,
  savedCatalogSelection,
}: {
  listingId: string;
  catalogUrls: string[];
  savedCatalogSelection: string[] | null;
}) {
  const router = useRouter();
  const [subsetPending, startSubset] = useTransition();
  const [allPending, startAll] = useTransition();
  const [subsetOk, setSubsetOk] = useState(false);
  const [allOk, setAllOk] = useState(false);
  const [subsetError, setSubsetError] = useState<string | null>(null);
  const [allError, setAllError] = useState<string | null>(null);

  useEffect(() => {
    setSubsetOk(false);
    setAllOk(false);
    setSubsetError(null);
    setAllError(null);
  }, [listingId]);

  const handleSubset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    startSubset(async () => {
      setSubsetError(null);
      const fd = new FormData(form);
      const r = await dashboardSetListingStorefrontCatalogImagesForm(initialCatalogImagesForm, fd);
      if (r.ok) {
        setSubsetOk(true);
        router.refresh();
        window.setTimeout(() => setSubsetOk(false), 2500);
      } else {
        setSubsetError(r.error);
      }
    });
  };

  const handleAll = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    startAll(async () => {
      setAllError(null);
      const fd = new FormData(form);
      const r = await dashboardSetListingStorefrontCatalogImagesForm(initialCatalogImagesForm, fd);
      if (r.ok) {
        setAllOk(true);
        router.refresh();
        window.setTimeout(() => setAllOk(false), 2500);
      } else {
        setAllError(r.error);
      }
    });
  };

  const subsetLabel = subsetPending ? "Saving…" : subsetOk ? "Saved" : "Save image selection";
  const subsetBtnClass = subsetPending ? savingSave : subsetOk ? savedSave : activeSave;

  const allLabel = allPending ? "Updating…" : allOk ? "Saved" : "Show all catalog images";
  const allBtnClass = allPending
    ? `${savingSave} w-full text-left sm:w-auto`
    : allOk
      ? `${savedSave} w-full text-left sm:w-auto`
      : "w-full rounded border border-zinc-700/80 bg-transparent px-2 py-1.5 text-left text-[11px] text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 sm:w-auto";

  return (
    <div className="mt-4 border-t border-zinc-800 pt-4">
      <p className="sr-only">Storefront catalog images — toggle which photos appear on your public product page.</p>
      <form onSubmit={handleSubset} className="space-y-3">
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="mode" value="subset" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5rem,1fr))]">
          {catalogUrls.map((url) => (
            <label key={url} className="group relative block cursor-pointer">
              <input
                type="checkbox"
                name="catalogUrl"
                value={url}
                defaultChecked={
                  savedCatalogSelection === null ? true : savedCatalogSelection.includes(url)
                }
                className="peer sr-only"
              />
              <span className="block overflow-hidden rounded-lg border border-zinc-700/90 bg-zinc-900/40 ring-2 ring-transparent ring-offset-2 ring-offset-zinc-950 transition peer-focus-visible:ring-blue-400/60 peer-checked:border-blue-600/50 peer-checked:ring-blue-500/75">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="aspect-square w-full object-cover transition group-hover:opacity-90"
                />
              </span>
            </label>
          ))}
        </div>
        {subsetError ? (
          <p className="text-xs text-red-400/95" role="alert">
            {subsetError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={subsetPending}
          className={`${subsetBtnClass} disabled:opacity-70`}
        >
          {subsetLabel}
        </button>
      </form>
      <form onSubmit={handleAll} className="mt-2">
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="mode" value="all" />
        {allError ? (
          <p className="mb-2 text-xs text-red-400/95" role="alert">
            {allError}
          </p>
        ) : null}
        <button type="submit" disabled={allPending} className={allBtnClass}>
          {allLabel}
        </button>
      </form>
    </div>
  );
}
