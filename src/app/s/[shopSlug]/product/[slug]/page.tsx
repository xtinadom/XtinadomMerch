import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { loadStorefrontListingByShopAndProductSlug } from "@/lib/product-storefront";
import { mapListingRowToProductDetail } from "@/lib/storefront-product-detail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopSlug: string; slug: string }> };

export default async function ShopTenantProductPage({ params }: Props) {
  const { shopSlug, slug } = await params;
  const row = await loadStorefrontListingByShopAndProductSlug(shopSlug, slug);
  if (!row) notFound();
  const detail = mapListingRowToProductDetail(row);
  return (
    <ProductDetailContent
      product={detail.product}
      variant="page"
      tenant={detail.tenant}
      printifyVariantShopPriceCentsById={detail.printifyVariantShopPriceCentsById}
      adminListingSecondaryImageUrl={detail.adminListingSecondaryImageUrl}
      ownerSupplementImageUrl={detail.ownerSupplementImageUrl}
      listingStorefrontCatalogImageUrls={detail.listingStorefrontCatalogImageUrls}
    />
  );
}
