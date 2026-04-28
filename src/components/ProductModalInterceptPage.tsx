import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { ProductModalShell } from "@/components/ProductModalShell";
import { resolvePublicProductDetail } from "@/lib/storefront-product-detail";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Shared body for modal intercept routes (`ProductModalShell` + tenant-aware resolution). */
export async function ProductModalInterceptBody({
  productSlug,
  shopSlug,
}: {
  productSlug: string;
  shopSlug?: string;
}) {
  const detail = await resolvePublicProductDetail(productSlug, shopSlug);
  if (!detail) notFound();
  return (
    <ProductModalShell>
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
        listingSearchKeywords={detail.listingSearchKeywords}
      />
    </ProductModalShell>
  );
}

/** Shared by `(store)/@modal/(.)product` and `(site-nav)/@modal/(...)product` intercept routes. */
export default async function ProductModalInterceptPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = typeof sp.shop === "string" ? sp.shop : undefined;
  return <ProductModalInterceptBody productSlug={slug} shopSlug={shop} />;
}
