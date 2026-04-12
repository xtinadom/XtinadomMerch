import { ShopAllProductsPage } from "@/components/ShopAllProductsPage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopSlug: string }> };

export default async function ShopTenantAllPage({ params }: Props) {
  const { shopSlug } = await params;
  return <ShopAllProductsPage shopSlug={shopSlug} />;
}
