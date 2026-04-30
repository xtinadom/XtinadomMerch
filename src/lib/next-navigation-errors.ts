/**
 * `redirect()` and `notFound()` from `next/navigation` throw special errors with a `digest`
 * string. Server components that catch Prisma failures must rethrow these so navigation works.
 *
 * - `redirect`: digest starts with `NEXT_REDIRECT` (see `next/navigation` in your Next version).
 * - `notFound`: digest is `NEXT_HTTP_ERROR_FALLBACK;404` (not `NEXT_NOT_FOUND`).
 */
export function rethrowNextNavigationError(e: unknown): void {
  if (typeof e === "object" && e !== null && "digest" in e) {
    const d = String((e as { digest?: unknown }).digest);
    if (
      d.startsWith("NEXT_REDIRECT") ||
      d.startsWith("NEXT_HTTP_ERROR_FALLBACK")
    ) {
      throw e;
    }
  }
}
