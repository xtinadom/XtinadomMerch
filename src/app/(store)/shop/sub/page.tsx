import { ShopCollectionPage } from "@/components/ShopCollectionPage";
import { CatalogGroup } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export default function SubShopPage() {
  return <ShopCollectionPage collection={CatalogGroup.sub} />;
}
