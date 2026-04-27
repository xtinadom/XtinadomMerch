/** Max length for `ShopListing.listingSearchKeywords`. */
export const SEARCH_KEYWORDS_MAX = 2000;

/** Collapse whitespace; empty → null; clip to {@link SEARCH_KEYWORDS_MAX}. */
export function normalizeSearchKeywords(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.slice(0, SEARCH_KEYWORDS_MAX);
}

/** Case-insensitive dedupe key for dashboard keyword chips (trim + lowercase). */
export function keywordDedupeFold(s: string): string {
  return s.trim().toLocaleLowerCase("en");
}

/** Parse stored whitespace-separated keywords into unique tokens (first spelling kept, case-insensitive). */
export function parseKeywordTokensFromStored(raw: string | null | undefined): string[] {
  const s = (raw ?? "").trim();
  if (!s) return [];
  const parts = s.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = keywordDedupeFold(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Merge new keyword pieces; skips case-insensitive duplicates and enforces max joined length. */
export function mergeKeywordPieces(
  prev: string[],
  cleaned: string[],
): { next: string[]; skippedDuplicate: boolean } {
  const seen = new Set(prev.map(keywordDedupeFold));
  let next = [...prev];
  let skippedDuplicate = false;
  for (const t of cleaned) {
    const key = keywordDedupeFold(t);
    if (seen.has(key)) {
      skippedDuplicate = true;
      continue;
    }
    const candidate = [...next, t].join(" ");
    if (candidate.length > SEARCH_KEYWORDS_MAX) break;
    seen.add(key);
    next.push(t);
  }
  return { next, skippedDuplicate };
}
