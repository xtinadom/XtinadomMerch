"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  dashboardSubmitListingRequest,
  dashboardUpdateListingPrice,
} from "@/actions/dashboard-marketplace";

const disabledSave =
  "cursor-not-allowed rounded bg-zinc-900/50 px-3 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-800";
const activeSave =
  "rounded bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700";
const savingSave =
  "cursor-wait rounded bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-300";
const savedSave =
  "cursor-default rounded border border-emerald-900/40 bg-zinc-900/50 px-3 py-1 text-xs font-medium text-emerald-300/90";

type PriceFormProps = {
  listingId: string;
  priceDollarsFormatted: string;
};

export function DashboardListingPriceForm({
  listingId,
  priceDollarsFormatted,
}: PriceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(priceDollarsFormatted);
  const baseline = useRef(priceDollarsFormatted);
  const [savedFlash, setSavedFlash] = useState(false);

  useLayoutEffect(() => {
    setPrice(priceDollarsFormatted);
    baseline.current = priceDollarsFormatted;
    setSavedFlash(false);
  }, [listingId, priceDollarsFormatted]);

  const dirty = price.trim() !== baseline.current.trim();

  useEffect(() => {
    if (dirty) setSavedFlash(false);
  }, [dirty]);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!dirty || pending) return;
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const r = await dashboardUpdateListingPrice(fd);
        router.refresh();
        if (r.ok) {
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 2500);
        }
      });
    },
    [dirty, pending, router],
  );

  const label = pending ? "Saving..." : savedFlash && !dirty ? "Saved" : "Save price";
  const btnClass = pending
    ? savingSave
    : !dirty
      ? savedFlash
        ? savedSave
        : disabledSave
      : activeSave;

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <label className="text-xs text-zinc-500">
        Your price (USD)
        <input
          type="text"
          name="priceDollars"
          value={price}
          onChange={(ev) => setPrice(ev.target.value)}
          className="ml-2 w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-200"
        />
      </label>
      <button type="submit" disabled={!dirty || pending} className={btnClass}>
        {label}
      </button>
    </form>
  );
}

type SubmitRequestFormProps = {
  listingId: string;
  defaultImageUrlsText: string;
};

export function DashboardSubmitListingRequestForm({
  listingId,
  defaultImageUrlsText,
}: SubmitRequestFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(defaultImageUrlsText);
  const [savedFlash, setSavedFlash] = useState(false);

  useLayoutEffect(() => {
    setText(defaultImageUrlsText);
    setSavedFlash(false);
  }, [listingId, defaultImageUrlsText]);

  const hasUrls = text.trim().length > 0;

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!hasUrls || pending) return;
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const r = await dashboardSubmitListingRequest(fd);
        router.refresh();
        if (r.ok) {
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 2500);
        }
      });
    },
    [hasUrls, pending, router],
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
        disabled={!hasUrls || pending || savedFlash}
        className={btnClass}
      >
        {label}
      </button>
    </form>
  );
}
