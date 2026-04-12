import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { loadStorefrontListingByShopAndProductSlug } from "@/lib/product-storefront";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopSlug: string; slug: string }> };

export default async function ShopTenantProductPage({ params }: Props) {
  const { shopSlug, slug } = await params;
  const row = await loadStorefrontListingByShopAndProductSlug(shopSlug, slug);
  if (!row) notFound();
  return (
    <ProductDetailContent
      product={row.product}
      variant="page"
      tenant={{ shopSlug, listingPriceCents: row.priceCents }}
    />
  );
}
