"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import {
  cropRegionMeetsPrintMinimum,
  effectiveArtworkDpiFromCropAndPrint,
  minSourceCropPixelsForPrintDpi,
  PRINT_AREA_REFERENCE_DPI,
} from "@/lib/listing-artwork-print-area";

/** Lets the artwork sit smaller than the crop frame (letterbox); export pads with white. */
const CROP_MIN_ZOOM = 0.2;
const CROP_MAX_ZOOM = 4;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Image failed to load")));
    img.setAttribute("crossOrigin", "anonymous");
    img.src = src;
  });
}

/** Bounding box of a `width`×`height` rectangle rotated by `rotationDeg` (same as react-easy-crop helpers). */
function rotateSize(width: number, height: number, rotationDeg: number): { width: number; height: number } {
  const rotRad = (rotationDeg * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * `pixelCrop` from react-easy-crop is in the rotated image’s bounding-box space when `rotationDeg !== 0`.
 * Draw rotated full image, crop that region, then scale to print pixels.
 */
async function getCroppedImageFile(
  imageSrc: string,
  pixelCrop: Area,
  outW: number,
  outH: number,
  rotationDeg: number,
  filename: string,
): Promise<File> {
  const image = await loadImage(imageSrc);
  const nw = image.naturalWidth;
  const nh = image.naturalHeight;
  const rad = (rotationDeg * Math.PI) / 180;
  const { width: bboxW, height: bboxH } = rotateSize(nw, nh, rotationDeg);

  const rotated = document.createElement("canvas");
  rotated.width = Math.round(bboxW);
  rotated.height = Math.round(bboxH);
  const rctx = rotated.getContext("2d");
  if (!rctx) throw new Error("Canvas unsupported");
  rctx.fillStyle = "#ffffff";
  rctx.fillRect(0, 0, rotated.width, rotated.height);
  rctx.imageSmoothingEnabled = true;
  rctx.imageSmoothingQuality = "high";
  rctx.translate(rotated.width / 2, rotated.height / 2);
  rctx.rotate(rad);
  rctx.drawImage(image, -nw / 2, -nh / 2);

  const cropped = document.createElement("canvas");
  cropped.width = Math.round(pixelCrop.width);
  cropped.height = Math.round(pixelCrop.height);
  const cctx = cropped.getContext("2d");
  if (!cctx) throw new Error("Canvas unsupported");
  cctx.fillStyle = "#ffffff";
  cctx.fillRect(0, 0, cropped.width, cropped.height);
  cctx.imageSmoothingEnabled = true;
  cctx.imageSmoothingQuality = "high";
  cctx.drawImage(
    rotated,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    cropped.width,
    cropped.height,
  );

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas unsupported");
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, out.width, out.height);
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(cropped, 0, 0, cropped.width, cropped.height, 0, 0, outW, outH);

  const blob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.92,
    );
  });
  return new File([blob], filename, { type: "image/jpeg", lastModified: Date.now() });
}

export function ListingArtworkCropDialog({
  open,
  imageUrl,
  printWidthPx,
  printHeightPx,
  minArtworkDpi,
  onClose,
  onComplete,
}: {
  open: boolean;
  imageUrl: string;
  printWidthPx: number;
  printHeightPx: number;
  /** When set with print area, requires more source pixels vs. 300 DPI template. */
  minArtworkDpi: number | null;
  onClose: () => void;
  onComplete: (file: File) => void;
}) {
  const aspect = printWidthPx / printHeightPx;
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRotation(0);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCroppedAreaPixels(null);
      setApplyError(null);
    }
  }, [open, imageUrl]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixelsInner: Area) => {
    setCroppedAreaPixels(croppedAreaPixelsInner);
    setApplyError(null);
  }, []);

  const effectiveDpi = useMemo(() => {
    if (!croppedAreaPixels) return null;
    return effectiveArtworkDpiFromCropAndPrint(
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      printWidthPx,
      printHeightPx,
    );
  }, [croppedAreaPixels, printWidthPx, printHeightPx]);

  const effectiveDpiBelowMin =
    effectiveDpi != null &&
    minArtworkDpi != null &&
    minArtworkDpi > 0 &&
    effectiveDpi + 0.01 < minArtworkDpi;

  async function apply() {
    setApplyError(null);
    if (!croppedAreaPixels) {
      setApplyError("Adjust the crop, then try again.");
      return;
    }
    const { minW, minH } = minSourceCropPixelsForPrintDpi(printWidthPx, printHeightPx, minArtworkDpi);
    if (!cropRegionMeetsPrintMinimum(croppedAreaPixels.width, croppedAreaPixels.height, minW, minH)) {
      setApplyError(
        minArtworkDpi != null && minArtworkDpi > 0
          ? `Zoom out so the crop covers at least ${minW}×${minH}px of your image (${minArtworkDpi} DPI vs. 300 DPI template — no upscaling).`
          : `Zoom out so the crop covers at least ${printWidthPx}×${printHeightPx}px of your image (no upscaling).`,
      );
      return;
    }
    setBusy(true);
    try {
      const file = await getCroppedImageFile(
        imageUrl,
        croppedAreaPixels,
        printWidthPx,
        printHeightPx,
        rotation,
        "listing-artwork.jpg",
      );
      onComplete(file);
    } catch {
      setApplyError("Could not build the cropped image. Try another file.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-artwork-crop-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 id="listing-artwork-crop-title" className="text-sm font-semibold text-zinc-100">
            Crop artwork to print area
          </h3>
        </div>
        <div className="relative h-[min(52vh,400px)] w-full bg-zinc-900">
          <Cropper
            key={imageUrl}
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={(z) =>
              setZoom(Math.min(CROP_MAX_ZOOM, Math.max(CROP_MIN_ZOOM, z)))
            }
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            restrictPosition={false}
            minZoom={CROP_MIN_ZOOM}
            maxZoom={CROP_MAX_ZOOM}
          />
        </div>
        <div className="space-y-2 border-t border-zinc-800 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Rotate</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRotation((r) => ((r - 90 + 360 * 4) % 360));
                setApplyError(null);
              }}
              className="rounded-lg border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
              aria-label="Rotate image 90 degrees counter-clockwise"
            >
              ⟲ 90°
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRotation((r) => (r + 90) % 360);
                setApplyError(null);
              }}
              className="rounded-lg border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
              aria-label="Rotate image 90 degrees clockwise"
            >
              ⟳ 90°
            </button>
            {rotation !== 0 ? (
              <span className="text-xs tabular-nums text-zinc-600">{rotation}°</span>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-10 shrink-0">Zoom</span>
            <input
              type="range"
              min={CROP_MIN_ZOOM}
              max={CROP_MAX_ZOOM}
              step={0.02}
              value={zoom}
              onChange={(e) => {
                const z = Number(e.target.value);
                setZoom(Math.min(CROP_MAX_ZOOM, Math.max(CROP_MIN_ZOOM, z)));
              }}
              className="min-w-0 flex-1"
            />
          </label>
          {applyError ? (
            <p className="text-xs text-amber-200/90" role="alert">
              {applyError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p
              className={`min-w-0 text-xs tabular-nums ${effectiveDpiBelowMin ? "text-amber-200/90" : "text-zinc-500"}`}
              aria-live="polite"
              title={`Relative to a ${PRINT_AREA_REFERENCE_DPI} DPI print template (${printWidthPx}×${printHeightPx}px).`}
            >
              {effectiveDpi != null ? (
                <>
                  Effective DPI: ~{Math.round(effectiveDpi)}
                  {minArtworkDpi != null && minArtworkDpi > 0 ? (
                    <span className={effectiveDpiBelowMin ? "text-amber-200/80" : "text-zinc-600"}>
                      {" "}
                      (min {minArtworkDpi})
                    </span>
                  ) : null}
                </>
              ) : (
                <>Effective DPI: —</>
              )}
            </p>
            <div className="flex shrink-0 justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                onClick={() => void apply()}
              >
                {busy ? "Saving…" : "Use cropped artwork"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
