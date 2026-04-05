import type { Prisma } from "@/generated/prisma/client";

const MAX_GALLERY = 20;

/** Parse newline- or comma-separated URLs; keep only http(s). */
export function parseImageUrlList(raw: string): string[] {
  const parts = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const line of parts) {
    try {
      const u = new URL(line);
      if (u.protocol === "http:" || u.protocol === "https:") {
        out.push(line);
      }
    } catch {
      /* skip invalid */
    }
    if (out.length >= MAX_GALLERY) break;
  }
  return out;
}

export function galleryFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const x of value) {
    if (typeof x === "string" && x.trim()) {
      try {
        const u = new URL(x.trim());
        if (u.protocol === "http:" || u.protocol === "https:") out.push(x.trim());
      } catch {
        /* skip */
      }
    }
    if (out.length >= MAX_GALLERY) break;
  }
  return out;
}

export function productImageUrls(product: {
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
}): string[] {
  const g = galleryFromJson(product.imageGallery);
  if (g.length > 0) return g;
  if (product.imageUrl?.trim()) return [product.imageUrl.trim()];
  return [];
}

export function productPrimaryImage(product: {
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
}): string | null {
  const urls = productImageUrls(product);
  return urls[0] ?? null;
}

export function toGalleryJson(urls: string[]): Prisma.InputJsonValue {
  return urls;
}
