import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { resolvePublicProductDetail } from "@/lib/storefront-product-detail";

/**
 * Minimal product view for admin iframe preview — same resolved PDP payload as
 * `/product/[slug]` (listing media, blurb, tenant when applicable), without site header.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function EmbedProductPage({ params }: Props) {
  const { slug } = await params;
  const detail = await resolvePublicProductDetail(slug);
  if (!detail) notFound();
  return (
    <div className="store-dimension-bg flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden">
      <div className="store-dimension-panel flex min-h-0 w-full flex-1 flex-col overflow-hidden shadow-2xl">
        <div className="store-product-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-6 sm:px-10 sm:pb-10 sm:pt-6">
          <ProductDetailContent
            product={detail.product}
            variant="modal"
            tenant={detail.tenant}
            printifyVariantShopPriceCentsById={detail.printifyVariantShopPriceCentsById}
            adminListingSecondaryImageUrl={detail.adminListingSecondaryImageUrl}
            ownerSupplementImageUrl={detail.ownerSupplementImageUrl}
            listingStorefrontCatalogImageUrls={detail.listingStorefrontCatalogImageUrls}
            adminCatalogStorefrontDescription={detail.adminCatalogStorefrontDescription}
            listingItemName={detail.listingItemName}
            adminCatalogItemName={detail.adminCatalogItemName}
            storefrontItemBlurb={detail.storefrontItemBlurb}
          />
        </div>
      </div>
    </div>
  );
}
