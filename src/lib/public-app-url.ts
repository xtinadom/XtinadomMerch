/**
 * `NEXT_PUBLIC_APP_URL` for redirects, Stripe return URLs, and canonical host logic.
 * In production, `http://` is upgraded to `https://` so browsers stay on a secure origin.
 *
 * Bare hostnames (e.g. `xtinadom.com`) are normalized — `new URL()` requires a scheme.
 * Prefer setting the full URL in Vercel: `https://www.xtinadom.com` (your real canonical host).
 */
export function publicAppBaseUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return undefined;
  let u = raw.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(u)) {
    const local =
      u.startsWith("localhost") ||
      u.startsWith("127.0.0.1") ||
      u.startsWith("[::1]");
    u = `${local ? "http" : "https"}://${u}`;
  }
  if (process.env.NODE_ENV === "production" && u.startsWith("http://")) {
    const rest = u.slice("http://".length);
    const isLocalHost =
      rest.startsWith("localhost") ||
      rest.startsWith("127.0.0.1") ||
      rest.startsWith("[::1]");
    if (!isLocalHost) {
      u = `https://${rest}`;
    }
  }
  return u;
}

export function publicAppOrigin(): URL | null {
  const base = publicAppBaseUrl();
  if (!base) return null;
  try {
    const url = new URL(base);
    if (process.env.NODE_ENV === "production" && url.protocol === "http:") {
      url.protocol = "https:";
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Base URL for Next.js `metadataBase`, Open Graph, and canonical links.
 * Prefer `NEXT_PUBLIC_APP_URL` (must be https:// in production for trust signals).
 * Falls back to `https://${VERCEL_URL}` on Vercel when the public URL env is unset.
 */
export function metadataBaseUrl(): URL {
  const base = publicAppBaseUrl();
  if (base) {
    try {
      const u = new URL(base);
      if (process.env.NODE_ENV === "production" && u.protocol === "http:") {
        u.protocol = "https:";
      }
      return u;
    } catch {
      /* fall through */
    }
  }

  const vu = process.env.VERCEL_URL?.trim();
  if (vu && process.env.NODE_ENV === "production") {
    const host = vu.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return new URL(`https://${host}`);
  }

  return new URL("http://localhost:3000");
}
