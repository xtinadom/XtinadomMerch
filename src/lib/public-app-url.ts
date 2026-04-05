/**
 * `NEXT_PUBLIC_APP_URL` for redirects, Stripe return URLs, and canonical host logic.
 * In production, `http://` is upgraded to `https://` so browsers stay on a secure origin.
 */
export function publicAppBaseUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return undefined;
  let u = raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" && u.startsWith("http://")) {
    u = `https://${u.slice("http://".length)}`;
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
