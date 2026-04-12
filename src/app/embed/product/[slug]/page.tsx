import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { loadStorefrontProductBySlug } from "@/lib/product-storefront";

/**
 * Minimal product view for admin iframe preview — same content as the storefront
 * quick-view modal, without site header or full product page chrome.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function EmbedProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await loadStorefrontProductBySlug(slug);
  if (!product) notFound();
  return (
    <div className="store-dimension-bg flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden">
      <div className="store-dimension-panel flex min-h-0 w-full flex-1 flex-col overflow-hidden shadow-2xl">
        <div className="store-product-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-6 sm:px-10 sm:pb-10 sm:pt-6">
          <ProductDetailContent product={product} variant="modal" />
        </div>
      </div>
    </div>
  );
}
