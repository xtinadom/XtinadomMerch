const MAX_BYTES = 20 * 1024 * 1024;

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const d = Number(m[4]);
  if ([a, b, c, d].some((n) => n > 255)) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** Returns an https URL suitable for server-side image fetch, or null. */
export function parseSafePublicHttpsImageUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (isBlockedHostname(u.hostname)) return null;
  if (u.username || u.password) return null;
  return u;
}

/** Fetch image bytes from a public HTTPS URL (admin import). */
export async function fetchPublicHttpsImage(url: URL): Promise<Buffer | null> {
  const res = await fetch(url.href, {
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
    headers: { "User-Agent": "XtinadomMerchAdminListingImage/1.0" },
  });
  if (!res.ok) return null;
  const ct = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ct.startsWith("image/")) return null;
  const len = res.headers.get("content-length");
  if (len && Number(len) > MAX_BYTES) return null;
  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_BYTES) return null;
  return Buffer.from(ab);
}
