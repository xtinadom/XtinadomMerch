import { randomBytes } from "node:crypto";
import sharp from "sharp";
import {
  isR2UploadConfigured,
  publicUrlToR2ObjectKey,
  putPublicR2Object,
} from "@/lib/r2-upload";

/** Default cap for stored primary image after compression (110 KiB). Override with PRINTIFY_IMPORT_IMAGE_MAX_BYTES. */
const DEFAULT_PRINTIFY_IMAGE_MAX_BYTES = 110 * 1024;

/** Refuse to download Printify sources larger than this (before compression). */
const MAX_SOURCE_DOWNLOAD_BYTES = 25 * 1024 * 1024;

function targetMaxBytes(): number {
  const raw = process.env.PRINTIFY_IMPORT_IMAGE_MAX_BYTES?.trim();
  if (!raw) return DEFAULT_PRINTIFY_IMAGE_MAX_BYTES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 5_000 ? n : DEFAULT_PRINTIFY_IMAGE_MAX_BYTES;
}

/** Avoid stale CDN bytes when Printify keeps the same mockup URL after a design refresh. */
function printifyMockupFetchUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.toLowerCase().includes("printify")) return url.trim();
    u.searchParams.set("_sf_fetch", String(Date.now()));
    return u.href;
  } catch {
    return url.trim();
  }
}

async function fetchPrintifyImage(
  url: string,
): Promise<{ buf: Buffer; contentType: string } | null> {
  const fetchUrl = printifyMockupFetchUrl(url);
  const res = await fetch(fetchUrl, { cache: "no-store", redirect: "follow" });
  if (!res.ok) return null;
  const cl = res.headers.get("content-length");
  if (cl) {
    const len = parseInt(cl, 10);
    if (Number.isFinite(len) && len > MAX_SOURCE_DOWNLOAD_BYTES) return null;
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_SOURCE_DOWNLOAD_BYTES) return null;
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  return { buf: Buffer.from(ab), contentType };
}

async function compressToJpegUnderCap(
  input: Buffer,
  maxBytes: number,
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
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

    let q = 88;
    let maxDim = 2048;
    let buf = await tryEncode(maxDim, q);
    while (buf.length > maxBytes && q > 26) {
      q -= 8;
      buf = await tryEncode(maxDim, q);
    }
    while (buf.length > maxBytes && maxDim > 480) {
      maxDim = Math.floor(maxDim * 0.82);
      buf = await tryEncode(maxDim, Math.max(q, 32));
    }
    if (buf.length > maxBytes) return null;
    return buf;
  } catch {
    return null;
  }
}

function extForUpload(contentType: string, jpeg: boolean): { ext: string; ct: string } {
  if (jpeg) return { ext: "jpg", ct: "image/jpeg" };
  if (contentType === "image/png") return { ext: "png", ct: "image/png" };
  if (contentType === "image/webp") return { ext: "webp", ct: "image/webp" };
  if (contentType === "image/gif") return { ext: "gif", ct: "image/gif" };
  return { ext: "bin", ct: contentType };
}

export function safePrintifyIdForR2Key(printifyProductId: string): string {
  return printifyProductId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "product";
}

/**
 * Download Printify mockup, compress to ≤ target bytes (JPEG path), upload to R2.
 * Returns public URL, or null if R2 is off / pipeline failed.
 */
export async function compressPrintifyImageToR2(
  printifyImageUrl: string,
  printifyProductId: string,
): Promise<string | null> {
  if (!isR2UploadConfigured()) return null;

  const maxBytes = targetMaxBytes();
  const got = await fetchPrintifyImage(printifyImageUrl);
  if (!got) return null;
  const { buf, contentType } = got;

  const jpeg = await compressToJpegUnderCap(buf, maxBytes);
  let body: Buffer;
  let outCt: string;
  let ext: string;
  if (jpeg) {
    body = jpeg;
    outCt = "image/jpeg";
    ext = "jpg";
  } else if (buf.length <= maxBytes && contentType.startsWith("image/")) {
    body = buf;
    const mapped = extForUpload(contentType, false);
    ext = mapped.ext;
    outCt = mapped.ct;
  } else {
    return null;
  }

  const safeId = safePrintifyIdForR2Key(printifyProductId);
  const key = `listing/printify/${safeId}-${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;

  try {
    return await putPublicR2Object({ key, body, contentType: outCt });
  } catch {
    return null;
  }
}

/** Stored primary URL: R2 (compressed) when configured; otherwise original Printify URL. */
export async function resolvePrintifyPrimaryImageUrl(
  printifyImageUrl: string | null,
  printifyProductId: string,
): Promise<string | null> {
  if (!printifyImageUrl?.trim()) return null;
  const url = printifyImageUrl.trim();
  const uploaded = await compressPrintifyImageToR2(url, printifyProductId);
  if (uploaded) return uploaded;
  /** Without R2, still bump a query param so the stored hero URL changes after each sync when Printify reuses the same mockup path. */
  return printifyMockupFetchUrl(url);
}

/**
 * R2 key for admin-uploaded gallery images on a Printify listing (same prefix as hero: listing/printify/).
 * Uses `-upload-` so {@link isPrintifyManagedListingImageUrl} does not treat these as API-sync mockups.
 */
export function buildListingPrintifyUserUploadKey(
  printifyProductId: string | null | undefined,
  ext: string,
): string {
  const safeId = safePrintifyIdForR2Key((printifyProductId ?? "").trim() || "listing");
  return `listing/printify/${safeId}-upload-${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
}

/** Hero / mockup from Printify (CDN or our compressed copy under listing/printify/). */
export function isPrintifyManagedListingImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  const key = publicUrlToR2ObjectKey(u);
  if (key && key.startsWith("listing/printify/")) {
    if (key.includes("-upload-")) return false;
    return true;
  }
  try {
    const parsed = new URL(u);
    if (parsed.hostname.toLowerCase().includes("printify")) return true;
  } catch {
    /* skip */
  }
  return false;
}

/**
 * On resync: new Printify hero first, then any URLs that are not Printify-managed (manual uploads, etc.).
 */
export function mergePrintifyResyncGallery(
  previousUrls: readonly string[],
  primaryImageUrl: string | null,
): string[] {
  const manual = previousUrls.filter((url) => !isPrintifyManagedListingImageUrl(url));
  const primary = primaryImageUrl?.trim() || null;
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string | null) => {
    const t = s?.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  add(primary);
  for (const m of manual) add(m);
  return out;
}
