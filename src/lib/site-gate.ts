import { publicAppOrigin } from "@/lib/public-app-url";

/** HttpOnly cookie storing a short-lived JWT; verified in proxy (Node). */
export const SITE_GATE_COOKIE = "xtina_site_gate";

/**
 * Share the gate cookie across www and apex (e.g. `www.xtinadom.com` vs `xtinadom.com`).
 * Without this, signing in on one host does not unlock routes on the other.
 * Skipped on localhost and *.vercel.app previews.
 */
export function siteGateCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  const origin = publicAppOrigin();
  if (!origin) return undefined;
  const host = origin.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return undefined;
  if (host.endsWith(".vercel.app")) return undefined;
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return undefined;
  return `.${parts.slice(-2).join(".")}`;
}
