import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { ProductStorefrontViewBeacon } from "@/components/ProductStorefrontViewBeacon";
import { loadStorefrontListingByShopAndProductSlug } from "@/lib/product-storefront";
import {
  mapListingRowToProductDetail,
  resolveAdminCatalogItemName,
  resolveAdminCatalogStorefrontText,
} from "@/lib/storefront-product-detail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopSlug: string; slug: string }> };

export default async function ShopTenantProductPage({ params }: Props) {
  const { shopSlug, slug } = await params;
  const row = await loadStorefrontListingByShopAndProductSlug(shopSlug, slug);
  if (!row) notFound();
  const detail = mapListingRowToProductDetail(row);
  const [adminCatalogStorefrontDescription, adminCatalogItemName] = await Promise.all([
    resolveAdminCatalogStorefrontText(row.product, row),
    resolveAdminCatalogItemName(row.product, row),
  ]);
  return (
    <>
      <ProductStorefrontViewBeacon productSlug={detail.product.slug} />
      <ProductDetailContent
        product={detail.product}
        variant="page"
        tenant={detail.tenant}
        printifyVariantShopPriceCentsById={detail.printifyVariantShopPriceCentsById}
        adminListingSecondaryImageUrl={detail.adminListingSecondaryImageUrl}
        ownerSupplementImageUrl={detail.ownerSupplementImageUrl}
        listingStorefrontCatalogImageUrls={detail.listingStorefrontCatalogImageUrls}
        adminCatalogStorefrontDescription={adminCatalogStorefrontDescription}
        listingItemName={detail.listingItemName}
        adminCatalogItemName={adminCatalogItemName}
        storefrontItemBlurb={detail.storefrontItemBlurb}
      />
    </>
  );
}
