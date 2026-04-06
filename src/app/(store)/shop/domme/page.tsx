import { ShopCollectionPage } from "@/components/ShopCollectionPage";
import { CatalogGroup } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export default async function DommeShopPage() {
  return <ShopCollectionPage collection={CatalogGroup.domme} />;
}
