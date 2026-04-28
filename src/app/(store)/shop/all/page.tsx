import { ShopAllProductsPage } from "@/components/ShopAllProductsPage";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ShopAllRoutePage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const tag = typeof sp.tag === "string" ? sp.tag : undefined;
  const sort = typeof sp.sort === "string" ? sp.sort : undefined;
  return <ShopAllProductsPage searchQuery={q} tagSlug={tag} browseSort={sort} />;
}
