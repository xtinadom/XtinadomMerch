"use client";

/** Per catalog item: optional print/DPI note + minimum long-edge pixel requirement for submitted artwork. */
export function AdminCatalogArtworkRequirementFields({
  imageRequirementLabel,
  minLongEdgePx,
  onChangeImageRequirementLabel,
  onChangeMinLongEdgePx,
}: {
  imageRequirementLabel: string;
  minLongEdgePx: string;
  onChangeImageRequirementLabel: (v: string) => void;
  onChangeMinLongEdgePx: (v: string) => void;
}) {
  return (
    <div className="space-y-3 border-t border-zinc-800/80 pt-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Artwork / resolution</p>
      <p className="text-[11px] leading-relaxed text-zinc-600">
        Optional. Set a minimum <strong className="text-zinc-500">longest edge in pixels</strong> for the image
        file creators upload. Use the label to explain print size / DPI (e.g. 12&quot; at 300 DPI ≈ 3600px). When the
        minimum is set, the listing request form blocks undersized files.
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
      <label className="block text-xs text-zinc-500">
        Minimum long edge (px)
        <input
          type="text"
          inputMode="numeric"
          value={minLongEdgePx}
          onChange={(e) => onChangeMinLongEdgePx(e.target.value)}
          placeholder="e.g. 3600 — leave blank to skip"
          className="mt-1 block w-full max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100"
        />
      </label>
    </div>
  );
}
