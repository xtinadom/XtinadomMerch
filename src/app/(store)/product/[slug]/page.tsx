import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { ProductStorefrontViewBeacon } from "@/components/ProductStorefrontViewBeacon";
import { resolvePublicProductDetail } from "@/lib/storefront-product-detail";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = typeof sp.shop === "string" ? sp.shop : undefined;
  const detail = await resolvePublicProductDetail(slug, shop);
  if (!detail) notFound();
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
        adminCatalogStorefrontDescription={detail.adminCatalogStorefrontDescription}
        listingItemName={detail.listingItemName}
        adminCatalogItemName={detail.adminCatalogItemName}
        storefrontItemBlurb={detail.storefrontItemBlurb}
      />
    </>
  );
}
