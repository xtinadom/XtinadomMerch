import {
  PLATFORM_ALL_PAGE_FEATURED_LIMIT,
  PLATFORM_ALL_PAGE_FEATURED_SALES_WINDOW_DAYS,
} from "@/lib/platform-all-page-featured-constants";

/**
 * Reference only: `/shop/all` “Hot items” is filled in code (see `getPlatformAllPageFeaturedProducts`).
 */
export function AdminPlatformBrowseFeaturedPanel() {
  return (
    <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-zinc-100">Platform — /shop/all “Hot items”</h3>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500">
        The featured strip on <span className="font-mono text-zinc-400">/shop/all</span> (up to{" "}
        {PLATFORM_ALL_PAGE_FEATURED_LIMIT} cards) is automatic. Order: (1) paid Hot item
        promotions, newest paid first; (2) best-selling live
        listings from paid order lines in the last {PLATFORM_ALL_PAGE_FEATURED_SALES_WINDOW_DAYS} days; (3){" "}
        highest <code className="text-zinc-400">Product.storefrontViewCount</code> (lifetime — we do not
        store views by day); (4) live listings from fallback shop slugs — env{" "}
        <code className="text-zinc-400">PLATFORM_HOT_ITEMS_FALLBACK_SHOP_SLUGS</code> (comma-separated), or
        default <code className="text-zinc-400">xtinadom</code>, <code className="text-zinc-400">xtinadom-merch</code>
        .
      </p>
    </div>
  );
}
