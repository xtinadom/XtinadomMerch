import { CatalogGroup } from "@/generated/prisma/enums";
import { ShopCollectionPage } from "@/components/ShopCollectionPage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopSlug: string }> };

export default async function ShopTenantDommePage({ params }: Props) {
  const { shopSlug } = await params;
  return <ShopCollectionPage collection={CatalogGroup.domme} shopSlug={shopSlug} />;
}
