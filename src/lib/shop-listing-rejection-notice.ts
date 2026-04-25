/**
 * Rejection notices store a full sentence in `body`. The admin reject flow includes a `Reason: …` clause
 * (optionally followed by older trailing copy such as “Open the Listings tab…”).
 */
export function extractRejectionReasonClauseFromNoticeBody(body: string): string | null {
  const idx = body.indexOf("Reason:");
  if (idx === -1) return null;
  const tail = body.slice(idx);
  const legacyEnd = tail.indexOf(" Open the Listings tab");
  const slice = (legacyEnd >= 0 ? tail.slice(0, legacyEnd) : tail).trim();
  return slice || null;
}

/** Picks the newest matching `listing_rejected` notice for this listing (prefers `relatedListingId`). */
export function resolveListingRejectionNoticeBody(
  noticesNewestFirst: Array<{
    kind: string;
    body: string;
    relatedListingId: string | null;
  }>,
  listingId: string,
  productName: string,
): string | null {
  for (const n of noticesNewestFirst) {
    if (n.kind !== "listing_rejected") continue;
    if (n.relatedListingId === listingId) return n.body;
  }
  const curly = `for “${productName}”`;
  const straight = `for "${productName}"`;
  for (const n of noticesNewestFirst) {
    if (n.kind !== "listing_rejected") continue;
    if (n.body.includes(curly) || n.body.includes(straight)) return n.body;
  }
  return null;
}

export function listingRejectionReasonTextForCard(noticeBody: string | null): string | null {
  if (!noticeBody) return null;
  const clause = extractRejectionReasonClauseFromNoticeBody(noticeBody);
  if (clause) return clause;
  if (noticeBody.includes("from review and marked it rejected")) {
    return "Removed from admin review and marked rejected.";
  }
  return null;
}
