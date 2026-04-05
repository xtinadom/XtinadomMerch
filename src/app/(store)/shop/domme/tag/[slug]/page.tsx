import { ShopCollectionPage } from "@/components/ShopCollectionPage";
import { CatalogGroup } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function DommeShopTagPage({ params }: Props) {
  const { slug } = await params;
  return <ShopCollectionPage collection={CatalogGroup.domme} tagSlug={slug} />;
}
