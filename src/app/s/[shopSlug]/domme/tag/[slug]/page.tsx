import { CatalogGroup } from "@/generated/prisma/enums";
import { ShopCollectionPage } from "@/components/ShopCollectionPage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopSlug: string; slug: string }> };

export default async function ShopTenantDommeTagPage({ params }: Props) {
  const { shopSlug, slug } = await params;
  return (
    <ShopCollectionPage
      collection={CatalogGroup.domme}
      tagSlug={slug}
      shopSlug={shopSlug}
    />
  );
}
