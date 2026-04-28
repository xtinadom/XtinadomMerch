import { ShopAllProductsPage } from "@/components/ShopAllProductsPage";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShopTenantAllPage({ params, searchParams }: Props) {
  const { shopSlug } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const browseFlat = sp.flat === "1";
  const tag = typeof sp.tag === "string" ? sp.tag : undefined;
  const sort = typeof sp.sort === "string" ? sp.sort : undefined;
  return (
    <ShopAllProductsPage
      shopSlug={shopSlug}
      searchQuery={q}
      browseFlat={browseFlat}
      tagSlug={tag}
      browseSort={sort}
    />
  );
}
