/** Upper bound for admin-configured print template pixels (one edge). */
export const LISTING_PRINT_AREA_PIXEL_MAX = 16_000;

/**
 * Admin print-area W×H is assumed to be specified at this DPI when combining with {@link minSourceCropPixelsForPrintDpi}.
 * Example: min DPI 600 requires twice as many source pixels as the template pixel size.
 */
export const PRINT_AREA_REFERENCE_DPI = 300;

/** Minimum source crop width/height (px) for print template + optional min DPI gate. */
export function minSourceCropPixelsForPrintDpi(
  printW: number,
  printH: number,
  minDpi: number | null,
  referenceDpi: number = PRINT_AREA_REFERENCE_DPI,
): { minW: number; minH: number } {
  const ref = referenceDpi > 0 ? referenceDpi : PRINT_AREA_REFERENCE_DPI;
  const dpi = minDpi != null && minDpi > 0 ? minDpi : ref;
  const factor = dpi / ref;
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return {
    minW: Math.ceil(printW * f),
    minH: Math.ceil(printH * f),
  };
}

/**
 * Effective DPI from a source crop that will be scaled to the print template, assuming the template’s
 * pixel size is defined at {@link PRINT_AREA_REFERENCE_DPI}. Uses the limiting axis (min of width/height ratios).
 */
export function effectiveArtworkDpiFromCropAndPrint(
  cropW: number,
  cropH: number,
  printW: number,
  printH: number,
  referenceDpi: number = PRINT_AREA_REFERENCE_DPI,
): number | null {
  if (!(cropW > 0) || !(cropH > 0) || !(printW > 0) || !(printH > 0)) return null;
  const ref = referenceDpi > 0 ? referenceDpi : PRINT_AREA_REFERENCE_DPI;
  const dpiW = (cropW * ref) / printW;
  const dpiH = (cropH * ref) / printH;
  const raw = Math.min(dpiW, dpiH);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

/**
 * Parse optional print-area width/height from form strings.
 * Both blank → nulls. Both valid integers → pair. Mixed blank → error.
 */
export function parsePrintAreaDimensionPair(
  widthRaw: string,
  heightRaw: string,
):
  | { ok: true; width: null; height: null }
  | { ok: true; width: number; height: number }
  | { ok: false; error: string } {
  const wStr = widthRaw.trim();
  const hStr = heightRaw.trim();
  if (wStr.length === 0 && hStr.length === 0) {
    return { ok: true, width: null, height: null };
  }
  if (wStr.length === 0 || hStr.length === 0) {
    return {
      ok: false,
      error: "Set both print area width and height (pixels), or leave both blank.",
    };
  }
  const w = parseInt(wStr, 10);
  const h = parseInt(hStr, 10);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
    return { ok: false, error: "Print area width and height must be whole numbers of at least 1 pixel." };
  }
  if (w > LISTING_PRINT_AREA_PIXEL_MAX || h > LISTING_PRINT_AREA_PIXEL_MAX) {
    return {
      ok: false,
      error: `Print area dimensions must be at most ${LISTING_PRINT_AREA_PIXEL_MAX}px per side.`,
    };
  }
  return { ok: true, width: w, height: h };
}

/** Crop region in source-image pixels meets minimum coverage for print DPI (no upscaling). */
export function cropRegionMeetsPrintMinimum(
  regionWidth: number,
  regionHeight: number,
  printW: number,
  printH: number,
  epsilon = 0.75,
): boolean {
  if (!(regionWidth > 0) || !(regionHeight > 0) || !(printW > 0) || !(printH > 0)) return false;
  return regionWidth + epsilon >= printW && regionHeight + epsilon >= printH;
}

/** Final raster (after crop/export) matches template size within tolerance. */
export function exportedImageMeetsPrintDimensions(
  imgW: number,
  imgH: number,
  printW: number,
  printH: number,
  tolerancePx = 1,
): boolean {
  if (!(imgW > 0) || !(imgH > 0)) return false;
  return (
    Math.abs(imgW - printW) <= tolerancePx &&
    Math.abs(imgH - printH) <= tolerancePx
  );
}
