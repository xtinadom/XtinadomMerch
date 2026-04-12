"use client";

import { useCallback, useEffect, useState } from "react";
import { uploadListingImage } from "@/actions/admin";
import { useListingFormRecalc } from "@/components/admin/listing-form-recalc-context";
import { MAX_GALLERY, uniqueImageUrlsOrdered } from "@/lib/product-media";

function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return [...arr];
  }
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type Props = {
  /** Initial image URLs (order preserved). */
  defaultUrls: string[];
  /**
   * When `"printify"`, uploads use `listing/printify/…` (same R2 prefix as Printify hero).
   * Pass {@link printifyProductId} when known for stable key grouping.
   */
  listingUploadVariant?: "printify";
  printifyProductId?: string | null;
};

export function ListingGalleryEditor({
  defaultUrls,
  listingUploadVariant,
  printifyProductId,
}: Props) {
  const snapshot = defaultUrls.join("\u001f");
  const [urls, setUrls] = useState(() => uniqueImageUrlsOrdered(defaultUrls));
  const [urlDraft, setUrlDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const recalc = useListingFormRecalc();

  const bump = useCallback(() => {
    queueMicrotask(() => recalc?.());
  }, [recalc]);

  useEffect(() => {
    setUrls(uniqueImageUrlsOrdered(defaultUrls));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when URL list content changes (snapshot), not array identity
  }, [snapshot]);

  const applyUrls = useCallback(
    (next: string[]) => {
      const trimmed = uniqueImageUrlsOrdered(next).slice(0, MAX_GALLERY);
      setUrls(trimmed);
      setMessage(null);
      bump();
    },
    [bump],
  );

  const addUrl = () => {
    const s = urlDraft.trim();
    if (!s) return;
    if (!isValidHttpUrl(s)) {
      setMessage("Enter a valid http(s) URL.");
      return;
    }
    if (urls.length >= MAX_GALLERY) {
      setMessage(`Maximum ${MAX_GALLERY} images.`);
      return;
    }
    if (urls.includes(s)) {
      setMessage("That URL is already in the list.");
      return;
    }
    applyUrls([...urls, s]);
    setUrlDraft("");
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (urls.length >= MAX_GALLERY) {
      setMessage(`Maximum ${MAX_GALLERY} images.`);
      return;
    }
    setUploading(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("file", file);
    if (listingUploadVariant === "printify") {
      fd.append("listingUploadVariant", "printify");
      if (printifyProductId?.trim()) {
        fd.append("printifyProductId", printifyProductId.trim());
      }
    }
    const r = await uploadListingImage(fd);
    setUploading(false);
    if (!r.ok) {
      setMessage(r.error);
      return;
    }
    applyUrls([...urls, r.url]);
  };

  const galleryValue = urls.join("\n");

  return (
    <div className="space-y-3">
      <input type="hidden" name="gallery" value={galleryValue} />

      <div className="text-xs text-zinc-500">
        <span className="font-medium text-zinc-400">Photos</span> —{" "}
        <span className="text-zinc-600">
          Reorder, remove, paste a URL, or upload (JPEG, PNG, WebP, GIF; max 8 MB). Up to {MAX_GALLERY}{" "}
          images.
        </span>
      </div>

      {urls.length === 0 ? (
        <p className="text-xs text-zinc-600">No photos yet — add a URL or upload a file.</p>
      ) : (
        <ul className="space-y-2">
          {urls.map((src, i) => (
            <li
              key={`${src}-${i}`}
              draggable
              aria-label={`Photo ${i + 1} of ${urls.length}`}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => {
                ev.preventDefault();
                if (dragIndex === null) return;
                const to = i;
                if (dragIndex === to) return;
                applyUrls(move(urls, dragIndex, to));
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 ${
                dragIndex === i ? "opacity-60" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Photo ${i + 1}`}
                className="h-14 w-14 shrink-0 rounded border border-zinc-700 object-cover"
              />
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => applyUrls(move(urls, i, i - 1))}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === urls.length - 1}
                  onClick={() => applyUrls(move(urls, i, i + 1))}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => applyUrls(urls.filter((_, j) => j !== i))}
                  className="rounded border border-blue-900/50 bg-blue-950/30 px-2 py-1 text-xs text-blue-300/90 hover:bg-blue-950/50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block text-xs text-zinc-500">
          Add image URL
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
              placeholder="https://…"
              className="min-w-[12rem] flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-300"
            />
            <button
              type="button"
              onClick={addUrl}
              disabled={urls.length >= MAX_GALLERY}
              className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add URL
            </button>
          </div>
        </label>
        <label className="block text-xs text-zinc-500">
          Upload file
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading || urls.length >= MAX_GALLERY}
            onChange={onUpload}
            className="mt-1 block w-full max-w-xs text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-zinc-200"
          />
        </label>
      </div>

      {uploading ? <p className="text-xs text-zinc-500">Uploading…</p> : null}
      {message ? <p className="text-xs text-amber-400/90">{message}</p> : null}
    </div>
  );
}
