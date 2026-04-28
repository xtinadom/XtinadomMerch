import { ProductModalInterceptBody } from "@/components/ProductModalInterceptPage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shopSlug: string; slug: string }> };

/** Soft navigation from `/s/[shopSlug]/all` (etc.) opens product as overlay; hard navigation uses `product/[slug]/page`. */
export default async function ShopTenantProductModalInterceptPage({ params }: Props) {
  const { shopSlug, slug } = await params;
  return <ProductModalInterceptBody productSlug={slug} shopSlug={shopSlug} />;
}
