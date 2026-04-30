import type { DashboardMainTabId } from "@/lib/dashboard-main-tab-id";

/**
 * Public `?dash=` value for the Promotions tab. Some browsers, extensions, or corporate
 * filters block or strip URLs containing "promotion", which prevents client navigations
 * from updating the address bar or completing an RSC round-trip.
 */
export const DASH_QUERY_LISTING_BOOSTS = "listingBoosts";

/** Normalize `dash` query from the URL to the canonical tab identifier used server-side / in scopes. */
export function dashboardTabParamToId(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  if (raw === DASH_QUERY_LISTING_BOOSTS || raw === "promotions") return "promotions";
  return raw;
}

/** Emit the `dash` query value for links and redirects (`promotions` → neutral alias). */
export function dashQueryParamForTabId(id: DashboardMainTabId): string {
  return id === "promotions" ? DASH_QUERY_LISTING_BOOSTS : id;
}
