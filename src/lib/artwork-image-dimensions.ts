import sharp from "sharp";

/** Longest side in pixels from raster image buffer (for listing artwork checks). */
export async function longEdgeLengthPxFromImageBuffer(buf: Buffer): Promise<number | null> {
  const meta = await sharp(buf, { failOn: "none" }).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 1 || h < 1) return null;
  return Math.max(w, h);
}
