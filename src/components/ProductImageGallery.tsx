"use client";

import { useEffect, useMemo, useState } from "react";
import { uniqueImageUrlsOrdered } from "@/lib/product-media";

type Props = {
  images: string[];
  /** When this changes (e.g. selected Printify variant), reset the main image to the first URL. */
  resetKey?: string;
};

export function ProductImageGallery({ images, resetKey }: Props) {
  const list = useMemo(
    () => uniqueImageUrlsOrdered(images),
    // Stable when parent passes a new array each render with same contents
    [images.join("\u001f")],
  );

  const [mainIndex, setMainIndex] = useState(0);

  useEffect(() => {
    setMainIndex(0);
  }, [resetKey]);

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
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {list.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button
                type="button"
                onClick={() => setMainIndex(i)}
                className={`rounded-lg p-0 transition ${
                  i === mainIndex
                    ? "ring-2 ring-blue-500/70 ring-offset-2 ring-offset-zinc-950"
                    : "opacity-90 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-16 w-16 rounded-lg border border-zinc-800 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
