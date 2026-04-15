"use client";

import { useEffect, useMemo, useState } from "react";
import { uniqueImageUrlsOrdered } from "@/lib/product-media";

type Props = {
  images: string[];
  /** When this changes (e.g. selected Printify variant), move the main image to match `preferMainSrc` if it exists in `images`, else first. */
  resetKey?: string;
  /** e.g. variant mockup URL — must already be in `images` to select it; otherwise main falls back to first image. */
  preferMainSrc?: string | null;
};

export function ProductImageGallery({ images, resetKey, preferMainSrc }: Props) {
  const list = useMemo(
    () => uniqueImageUrlsOrdered(images),
    // Stable when parent passes a new array each render with same contents
    [images.join("\u001f")],
  );

  const [mainIndex, setMainIndex] = useState(0);

  useEffect(() => {
    if (resetKey === undefined) return;
    const prefer = preferMainSrc?.trim();
    if (prefer) {
      const idx = list.findIndex((u) => u.trim() === prefer);
      setMainIndex(idx >= 0 ? idx : 0);
    } else {
      setMainIndex(0);
    }
  }, [resetKey, list, preferMainSrc]);

  useEffect(() => {
    if (mainIndex >= list.length) setMainIndex(0);
  }, [list.length, mainIndex]);

  const main = list[mainIndex] ?? list[0];

  return (
    <>
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-zinc-900">
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center text-zinc-600">
            No image
          </div>
        )}
      </div>
      {list.length > 1 ? (
        <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] justify-items-center gap-2 sm:grid-cols-[repeat(auto-fill,minmax(6rem,1fr))]">
          {list.map((src, i) => (
            <li key={`${src}-${i}`} className="flex justify-center">
              <button
                type="button"
                onClick={() => setMainIndex(i)}
                className={`rounded border p-0 transition ${
                  i === mainIndex
                    ? "ring-2 ring-blue-500/75 ring-offset-2 ring-offset-zinc-950"
                    : "border-transparent opacity-95 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-24 w-24 rounded border border-zinc-700 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
