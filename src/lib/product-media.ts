import type { Prisma } from "@/generated/prisma/client";
import { parsePrintifyVariantsJson } from "@/lib/printify-variants";

/** Max images per product listing (admin + storefront). */
export const MAX_GALLERY = 20;

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

/**
 * Like {@link productImageUrls}, but if `imageUrl` is set and missing from the gallery JSON,
 * prepends it. Used for Printify sync so the prior hero is merged and removed from R2 when
 * a new mockup is imported (avoids orphans when gallery and imageUrl were out of sync).
 */
export function productImageUrlsUnionHero(product: {
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
}): string[] {
  const g = galleryFromJson(product.imageGallery);
  const hero = product.imageUrl?.trim() || "";
  if (!hero) {
    return uniqueImageUrlsOrdered(g);
  }
  const inGallery = g.some((x) => x.trim() === hero);
  if (inGallery) {
    return uniqueImageUrlsOrdered(g);
  }
  return uniqueImageUrlsOrdered([hero, ...g]);
}

/**
 * Hero ∪ gallery ∪ Printify variant `imageUrl` values (deduped). Use when deleting R2 listing
 * objects that are no longer referenced after a listing save.
 */
export function productAllStoredImageUrls(product: {
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
  printifyVariants?: Prisma.JsonValue | null;
}): string[] {
  const fromHeroGallery = productImageUrlsUnionHero(product);
  const fromVariants: string[] = [];
  for (const v of parsePrintifyVariantsJson(product.printifyVariants ?? null)) {
    const u = v.imageUrl?.trim();
    if (u) fromVariants.push(u);
  }
  return uniqueImageUrlsOrdered([...fromHeroGallery, ...fromVariants]);
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

/** Deduplicate image URLs while preserving first-seen order (for storefront galleries). */
export function uniqueImageUrlsOrdered(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const s = typeof u === "string" ? u.trim() : "";
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
