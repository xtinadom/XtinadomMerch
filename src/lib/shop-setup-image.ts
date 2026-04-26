import sharp from "sharp";

const PROFILE_MAX_BYTES = 100 * 1024;
/** Optional per-listing owner photo on the storefront (same cap as profile avatar). */
const LISTING_SUPPLEMENT_MAX_BYTES = 100 * 1024;
const LISTING_SUPPLEMENT_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const LISTING_MAX_BYTES = 4 * 1024 * 1024;
const LISTING_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/** Avatar for shop profile: WebP, must fit under 100 KiB. */
export async function compressShopProfileImageWebp(
  input: Buffer,
): Promise<Buffer | null> {
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    if (meta.format === "svg") return null;

    const tryEncode = async (maxDim: number, quality: number) =>
      sharp(input, { failOn: "none" })
        .rotate()
        .resize({
          width: maxDim,
          height: maxDim,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4 })
        .toBuffer();

    let q = 82;
    let maxDim = 512;
    let buf = await tryEncode(maxDim, q);
    while (buf.length > PROFILE_MAX_BYTES && q > 40) {
      q -= 6;
      buf = await tryEncode(maxDim, q);
    }
    while (buf.length > PROFILE_MAX_BYTES && maxDim > 160) {
      maxDim = Math.floor(maxDim * 0.85);
      buf = await tryEncode(maxDim, Math.max(q, 45));
    }
    if (buf.length > PROFILE_MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

/** One optional owner listing photo: WebP, max 100 KiB (dashboard → storefront gallery). */
export async function compressShopListingSupplementPhotoWebp(
  input: Buffer,
): Promise<Buffer | null> {
  if (input.length > LISTING_SUPPLEMENT_MAX_SOURCE_BYTES) return null;
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    if (meta.format === "svg") return null;

    const tryEncode = async (maxDim: number, quality: number) =>
      sharp(input, { failOn: "none" })
        .rotate()
        .resize({
          width: maxDim,
          height: maxDim,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4 })
        .toBuffer();

    let q = 82;
    let maxDim = 1200;
    let buf = await tryEncode(maxDim, q);
    while (buf.length > LISTING_SUPPLEMENT_MAX_BYTES && q > 40) {
      q -= 6;
      buf = await tryEncode(maxDim, q);
    }
    while (buf.length > LISTING_SUPPLEMENT_MAX_BYTES && maxDim > 320) {
      maxDim = Math.floor(maxDim * 0.85);
      buf = await tryEncode(maxDim, Math.max(q, 45));
    }
    if (buf.length > LISTING_SUPPLEMENT_MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

export type CompressShopListingArtworkOpts = {
  /** When true, only rotate + WebP encode (no resize) so print-area pixel dimensions are preserved. */
  preservePixelDimensions?: boolean;
};

/** Listing artwork for print review: high quality WebP, cap ~4 MiB. */
export async function compressShopListingArtworkWebp(
  input: Buffer,
  opts?: CompressShopListingArtworkOpts,
): Promise<Buffer | null> {
  if (input.length > LISTING_MAX_SOURCE_BYTES) return null;
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    if (meta.format === "svg") return null;

    if (opts?.preservePixelDimensions) {
      const tryEncodePreserve = async (quality: number) =>
        sharp(input, { failOn: "none" })
          .rotate()
          .webp({ quality, effort: 4, smartSubsample: true })
          .toBuffer();
      let q = 94;
      let buf = await tryEncodePreserve(q);
      while (buf.length > LISTING_MAX_BYTES && q > 50) {
        q -= 3;
        buf = await tryEncodePreserve(Math.max(q, 50));
      }
      if (buf.length > LISTING_MAX_BYTES) return null;
      return buf;
    }

    const tryEncode = async (maxDim: number, quality: number) =>
      sharp(input, { failOn: "none" })
        .rotate()
        .resize({
          width: maxDim,
          height: maxDim,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4, smartSubsample: true })
        .toBuffer();

    let q = 94;
    let maxDim = 4096;
    let buf = await tryEncode(maxDim, q);
    while (buf.length > LISTING_MAX_BYTES && q > 70) {
      q -= 4;
      buf = await tryEncode(maxDim, q);
    }
    while (buf.length > LISTING_MAX_BYTES && maxDim > 1600) {
      maxDim = Math.floor(maxDim * 0.88);
      buf = await tryEncode(maxDim, Math.max(q, 72));
    }
    if (buf.length > LISTING_MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}
