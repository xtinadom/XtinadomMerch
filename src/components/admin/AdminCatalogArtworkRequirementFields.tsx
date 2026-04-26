"use client";

import { PRINT_AREA_REFERENCE_DPI } from "@/lib/listing-artwork-print-area";

/** Per catalog item: optional print-area pixels, optional min DPI vs. reference, plus note for creators. */
export function AdminCatalogArtworkRequirementFields({
  imageRequirementLabel,
  printAreaWidthPx,
  printAreaHeightPx,
  minArtworkDpi,
  onChangeImageRequirementLabel,
  onChangePrintAreaWidthPx,
  onChangePrintAreaHeightPx,
  onChangeMinArtworkDpi,
}: {
  imageRequirementLabel: string;
  printAreaWidthPx: string;
  printAreaHeightPx: string;
  minArtworkDpi: string;
  onChangeImageRequirementLabel: (v: string) => void;
  onChangePrintAreaWidthPx: (v: string) => void;
  onChangePrintAreaHeightPx: (v: string) => void;
  onChangeMinArtworkDpi: (v: string) => void;
}) {
  return (
    <div className="space-y-3 border-t border-zinc-800/80 pt-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Artwork / resolution</p>
      <p className="text-[11px] leading-relaxed text-zinc-600">
        Optional. <strong className="text-zinc-500">Print area (px)</strong> — width and height of the Printify print
        file. When both are set, creators crop to that aspect and export that exact size.{" "}
        <strong className="text-zinc-500">Minimum DPI</strong> may only be set together with print area: it requires
        proportionally more pixels in the crop vs. the template, assuming the template dimensions are at{" "}
        {PRINT_AREA_REFERENCE_DPI} DPI (e.g. 600 DPI → twice the source pixels before downscale).
      </p>
      <label className="block text-xs text-zinc-500">
        Requirement note (optional)
        <input
          type="text"
          value={imageRequirementLabel}
          onChange={(e) => onChangeImageRequirementLabel(e.target.value)}
          maxLength={400}
          placeholder='e.g. 12" print @ 300 DPI'
          className="mt-1 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
        />
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="block text-xs text-zinc-500">
          Print area width (px)
          <input
            type="text"
            inputMode="numeric"
            value={printAreaWidthPx}
            onChange={(e) => onChangePrintAreaWidthPx(e.target.value)}
            placeholder="e.g. 4500 — blank with height"
            className="mt-1 block w-full min-w-[10rem] max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Print area height (px)
          <input
            type="text"
            inputMode="numeric"
            value={printAreaHeightPx}
            onChange={(e) => onChangePrintAreaHeightPx(e.target.value)}
            placeholder="e.g. 5400"
            className="mt-1 block w-full min-w-[10rem] max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Minimum DPI (optional)
          <input
            type="text"
            inputMode="numeric"
            value={minArtworkDpi}
            onChange={(e) => onChangeMinArtworkDpi(e.target.value)}
            placeholder={`blank = ${PRINT_AREA_REFERENCE_DPI}`}
            className="mt-1 block w-full min-w-[10rem] max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100"
          />
        </label>
      </div>
    </div>
  );
}
