import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Read `process.env` case-insensitively for `NAME` (e.g. `r2_Bucket` matches `R2_BUCKET`).
 * Dotenv leaves key spelling as written; this avoids silent misses.
 */
export function readR2Env(name: string): string | undefined {
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toLowerCase() === n && typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

/** Bucket id — `R2_BUCKET`, `R2_BUCKET_NAME`, `R2_Bucket_name`, etc. (keys matched case-insensitively). */
export function readR2BucketName(): string | undefined {
  return readR2Env("R2_BUCKET") ?? readR2Env("R2_BUCKET_NAME");
}

/**
 * Cloudflare R2 via S3-compatible API.
 * @see https://developers.cloudflare.com/r2/api/s3/api/
 */
export function isR2UploadConfigured(): boolean {
  return Boolean(
    readR2Env("R2_ACCESS_KEY_ID") &&
      readR2Env("R2_SECRET_ACCESS_KEY") &&
      readR2BucketName() &&
      readR2Env("R2_PUBLIC_BASE_URL") &&
      (readR2Env("R2_ACCOUNT_ID") || readR2Env("R2_ENDPOINT")),
  );
}

function r2S3Endpoint(): string {
  const custom = readR2Env("R2_ENDPOINT");
  if (custom) return custom.replace(/\/$/, "");
  const id = readR2Env("R2_ACCOUNT_ID");
  if (!id) throw new Error("R2_ACCOUNT_ID or R2_ENDPOINT is required");
  return `https://${id}.r2.cloudflarestorage.com`;
}

/** Upload bytes and return the public HTTPS URL (R2_PUBLIC_BASE_URL + / + key). */
export async function putPublicR2Object(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const bucket = readR2BucketName();
  const accessKeyId = readR2Env("R2_ACCESS_KEY_ID");
  const secretAccessKey = readR2Env("R2_SECRET_ACCESS_KEY");
  const baseUrl = readR2Env("R2_PUBLIC_BASE_URL")?.replace(/\/$/, "");

  if (!bucket || !accessKeyId || !secretAccessKey || !baseUrl) {
    throw new Error("R2 bucket credentials or R2_PUBLIC_BASE_URL missing");
  }

  const client = r2S3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  return `${baseUrl}/${params.key}`;
}

function r2S3Client(): S3Client {
  const accessKeyId = readR2Env("R2_ACCESS_KEY_ID");
  const secretAccessKey = readR2Env("R2_SECRET_ACCESS_KEY");
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials missing");
  }
  return new S3Client({
    region: "auto",
    endpoint: r2S3Endpoint(),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

/** Map a browser URL back to object key if it lives under R2_PUBLIC_BASE_URL. */
export function publicUrlToR2ObjectKey(publicUrl: string): string | null {
  const baseRaw = readR2Env("R2_PUBLIC_BASE_URL")?.trim();
  if (!baseRaw) return null;
  let u: URL;
  let b: URL;
  try {
    u = new URL(publicUrl.trim());
    b = new URL(baseRaw.includes("://") ? baseRaw : `https://${baseRaw}`);
  } catch {
    return null;
  }
  if (u.hostname.toLowerCase() !== b.hostname.toLowerCase()) return null;
  const basePath = b.pathname.replace(/\/$/, "");
  let path = u.pathname;
  if (basePath && basePath !== "/" && path.startsWith(basePath)) {
    path = path.slice(basePath.length);
  }
  const key = path.replace(/^\/+/, "");
  if (!key) return null;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

/**
 * Resolve R2 object key for listing-request artwork (`shops/{shopId}/listing-request/...`).
 * Uses {@link publicUrlToR2ObjectKey} when the URL matches `R2_PUBLIC_BASE_URL`; otherwise
 * accepts any HTTPS URL whose path is under that prefix (e.g. custom public domain).
 */
export function listingRequestArtworkUrlToObjectKey(
  publicUrl: string,
  shopId: string,
): string | null {
  const expectedPrefix = `shops/${shopId}/listing-request/`;

  const strict = publicUrlToR2ObjectKey(publicUrl);
  if (strict?.startsWith(expectedPrefix)) return strict;

  let u: URL;
  try {
    u = new URL(publicUrl.trim());
  } catch {
    return null;
  }

  let path = u.pathname;
  const baseRaw = readR2Env("R2_PUBLIC_BASE_URL")?.trim();
  if (baseRaw) {
    try {
      const b = new URL(baseRaw.includes("://") ? baseRaw : `https://${baseRaw}`);
      if (u.hostname.toLowerCase() === b.hostname.toLowerCase()) {
        const basePath = b.pathname.replace(/\/$/, "");
        if (basePath && basePath !== "/" && path.startsWith(basePath)) {
          path = path.slice(basePath.length);
        }
      }
    } catch {
      /* ignore */
    }
  }

  path = path.replace(/^\/+/, "");
  if (!path.startsWith(expectedPrefix)) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** String URLs from `ShopListing.requestImages` JSON (for R2 cleanup). */
export function shopListingRequestImageUrlStrings(requestImages: unknown): string[] {
  if (!Array.isArray(requestImages)) return [];
  const out: string[] = [];
  for (const x of requestImages) {
    if (typeof x === "string" && x.trim()) out.push(x.trim());
  }
  return out;
}

/**
 * Delete listing-request artwork objects under `shops/{shopId}/listing-request/`.
 * Only URLs that resolve to that prefix for the given shop are removed.
 */
export async function deleteShopListingRequestImagesFromR2(
  shopId: string,
  publicUrls: readonly string[],
): Promise<void> {
  if (!isR2UploadConfigured() || publicUrls.length === 0) return;
  const bucket = readR2BucketName();
  if (!bucket) return;
  const prefix = `shops/${shopId}/listing-request/`;
  const keys = new Set<string>();
  for (const raw of publicUrls) {
    const u = typeof raw === "string" ? raw.trim() : "";
    if (!u) continue;
    const key = listingRequestArtworkUrlToObjectKey(u, shopId);
    if (key?.startsWith(prefix)) keys.add(key);
  }
  if (keys.size === 0) return;
  const client = r2S3Client();
  for (const Key of keys) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Delete R2 objects for storefront image URLs that map to keys under `listing/`
 * (manual uploads and Printify-import JPEGs). External URLs are ignored.
 */
export async function deleteListingImagesFromR2(
  publicUrls: readonly string[],
): Promise<void> {
  if (!isR2UploadConfigured()) return;
  const keys = new Set<string>();
  for (const raw of publicUrls) {
    const u = typeof raw === "string" ? raw.trim() : "";
    if (!u) continue;
    const key = publicUrlToR2ObjectKey(u);
    if (key && key.startsWith("listing/")) keys.add(key);
  }
  if (keys.size === 0) return;
  await deleteR2ObjectsByKeys([...keys]);
}

/** Paginated list of object keys under a prefix (e.g. `listing/`). Omits zero-byte “folder” markers. */
export async function listR2ObjectKeysWithPrefix(prefix: string): Promise<string[]> {
  if (!isR2UploadConfigured()) {
    throw new Error("R2 is not configured");
  }
  const bucket = readR2BucketName();
  if (!bucket) {
    throw new Error("R2 bucket name missing");
  }
  const client = r2S3Client();
  const keys: string[] = [];
  let ContinuationToken: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken,
      }),
    );
    for (const o of res.Contents ?? []) {
      const k = o.Key;
      if (!k || k.endsWith("/")) continue;
      keys.push(k);
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

/** Single object key for a shop’s profile image (Put overwrites on each upload). */
export function shopProfileAvatarObjectKey(shopId: string): string {
  return `shops/${shopId}/avatar.webp`;
}

/** One optional owner storefront photo per listing (WebP, overwritten on each upload). */
export function shopListingSupplementImageObjectKey(shopId: string, listingId: string): string {
  return `shops/${shopId}/listing-supplement/${listingId}.webp`;
}

/**
 * Resolves a public URL to the supplement object key only when it matches this shop/listing’s
 * canonical R2 object (same hostname/path rules as listing-request artwork).
 */
export function listingSupplementImageUrlToObjectKey(
  publicUrl: string,
  shopId: string,
  listingId: string,
): string | null {
  const expectedKey = shopListingSupplementImageObjectKey(shopId, listingId);
  const strict = publicUrlToR2ObjectKey(publicUrl.trim());
  if (strict === expectedKey) return strict;

  let u: URL;
  try {
    u = new URL(publicUrl.trim());
  } catch {
    return null;
  }

  let path = u.pathname;
  const baseRaw = readR2Env("R2_PUBLIC_BASE_URL")?.trim();
  if (baseRaw) {
    try {
      const b = new URL(baseRaw.includes("://") ? baseRaw : `https://${baseRaw}`);
      if (u.hostname.toLowerCase() === b.hostname.toLowerCase()) {
        const basePath = b.pathname.replace(/\/$/, "");
        if (basePath && basePath !== "/" && path.startsWith(basePath)) {
          path = path.slice(basePath.length);
        }
      }
    } catch {
      /* ignore */
    }
  }

  path = path.replace(/^\/+/, "");
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep */
  }
  return path === expectedKey ? path : null;
}

/**
 * Only pass through URLs that point at this listing’s supplement object — never catalog/Printify/admin URLs.
 */
export function sanitizeShopListingOwnerSupplementImageUrlForDisplay(
  publicUrl: string | null | undefined,
  shopId: string,
  listingId: string,
): string | null {
  if (!publicUrl?.trim()) return null;
  return listingSupplementImageUrlToObjectKey(publicUrl, shopId, listingId)
    ? publicUrl.trim()
    : null;
}

/** Best-effort delete {@link shopListingSupplementImageObjectKey} (no-op if R2 unset). */
export async function deleteShopListingSupplementObject(
  shopId: string,
  listingId: string,
): Promise<void> {
  if (!isR2UploadConfigured()) return;
  const bucket = readR2BucketName();
  if (!bucket) return;
  const Key = shopListingSupplementImageObjectKey(shopId, listingId);
  try {
    await r2S3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key }));
  } catch {
    /* best-effort */
  }
}

/** Optional admin-set listing image (WebP, overwritten on each save). */
export function shopListingAdminSecondaryImageObjectKey(shopId: string, listingId: string): string {
  return `shops/${shopId}/listing-admin-secondary/${listingId}.webp`;
}

export function listingAdminSecondaryImageUrlToObjectKey(
  publicUrl: string,
  shopId: string,
  listingId: string,
): string | null {
  const expectedKey = shopListingAdminSecondaryImageObjectKey(shopId, listingId);
  const strict = publicUrlToR2ObjectKey(publicUrl.trim());
  if (strict === expectedKey) return strict;

  let u: URL;
  try {
    u = new URL(publicUrl.trim());
  } catch {
    return null;
  }

  let path = u.pathname;
  const baseRaw = readR2Env("R2_PUBLIC_BASE_URL")?.trim();
  if (baseRaw) {
    try {
      const b = new URL(baseRaw.includes("://") ? baseRaw : `https://${baseRaw}`);
      if (u.hostname.toLowerCase() === b.hostname.toLowerCase()) {
        const basePath = b.pathname.replace(/\/$/, "");
        if (basePath && basePath !== "/" && path.startsWith(basePath)) {
          path = path.slice(basePath.length);
        }
      }
    } catch {
      /* ignore */
    }
  }

  path = path.replace(/^\/+/, "");
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep */
  }
  if (path === expectedKey) return expectedKey;
  /** CDN / custom domain may add a path prefix; still require canonical key suffix. */
  if (
    (u.protocol === "https:" || u.protocol === "http:") &&
    path.endsWith("/" + expectedKey)
  ) {
    return expectedKey;
  }
  return null;
}

export function sanitizeShopListingAdminSecondaryImageUrlForDisplay(
  publicUrl: string | null | undefined,
  shopId: string,
  listingId: string,
): string | null {
  if (!publicUrl?.trim()) return null;
  return listingAdminSecondaryImageUrlToObjectKey(publicUrl, shopId, listingId)
    ? publicUrl.trim()
    : null;
}

export async function deleteShopListingAdminSecondaryObject(
  shopId: string,
  listingId: string,
): Promise<void> {
  if (!isR2UploadConfigured()) return;
  const bucket = readR2BucketName();
  if (!bucket) return;
  const Key = shopListingAdminSecondaryImageObjectKey(shopId, listingId);
  try {
    await r2S3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key }));
  } catch {
    /* best-effort */
  }
}

/**
 * Remove legacy profile avatars (`avatar-<uuid>.webp`) under `shops/{shopId}/`.
 * Does not touch `listing-request/` or the canonical `avatar.webp`.
 */
export async function deleteLegacyShopProfileAvatarKeys(shopId: string): Promise<void> {
  if (!isR2UploadConfigured()) return;
  const prefix = `shops/${shopId}/`;
  let keys: string[];
  try {
    keys = await listR2ObjectKeysWithPrefix(prefix);
  } catch {
    return;
  }
  const bucket = readR2BucketName();
  if (!bucket) return;
  const client = r2S3Client();
  const legacyName = /^avatar-.+\.webp$/i;
  for (const key of keys) {
    if (key.startsWith(`${prefix}listing-request/`)) continue;
    const rest = key.slice(prefix.length);
    if (!rest.includes("/") && legacyName.test(rest)) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch {
        /* best-effort */
      }
    }
  }
}

/** Best-effort delete by key. Only keys under `listing/` are removed (safety guard). */
export async function deleteR2ObjectsByKeys(keys: readonly string[]): Promise<number> {
  if (!isR2UploadConfigured() || keys.length === 0) return 0;
  const bucket = readR2BucketName();
  if (!bucket) return 0;

  const client = r2S3Client();
  let n = 0;
  for (const Key of keys) {
    if (!Key.startsWith("listing/")) continue;
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
      n += 1;
    } catch {
      /* best-effort cleanup */
    }
  }
  return n;
}
