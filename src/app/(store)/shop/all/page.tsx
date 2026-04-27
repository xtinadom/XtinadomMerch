import { ShopAllProductsPage } from "@/components/ShopAllProductsPage";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ShopAllRoutePage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  return <ShopAllProductsPage searchQuery={q} />;
}
