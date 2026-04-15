import { createHash } from "node:crypto";

/** Variant key for one stub product / listing covering every admin-catalog size line. */
export const BASELINE_ALL_VARIANTS_STUB_KEY = "allVariants";

/** Deterministic stub `Product.slug` for baseline picks (must match draft prefill + Printify remap). */
export function computeBaselineStubSlug(
  shopId: string,
  itemId: string,
  variantKey: string,
): string {
  const h = createHash("sha256")
    .update(`${shopId}|${itemId}|${variantKey}`)
    .digest("hex")
    .slice(0, 24);
  return `bl-${h}`;
}
