/** Max length for `ShopListing.listingSearchKeywords`. */
export const SEARCH_KEYWORDS_MAX = 2000;

/** Collapse whitespace; empty → null; clip to {@link SEARCH_KEYWORDS_MAX}. */
export function normalizeSearchKeywords(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.slice(0, SEARCH_KEYWORDS_MAX);
}
