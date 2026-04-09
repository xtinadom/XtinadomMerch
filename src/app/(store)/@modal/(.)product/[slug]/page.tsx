import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { ProductModalShell } from "@/components/ProductModalShell";
import { loadStorefrontProductBySlug } from "@/lib/product-storefront";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function ProductModalInterceptPage({ params }: Props) {
  const { slug } = await params;
  const product = await loadStorefrontProductBySlug(slug);
  if (!product) notFound();
  return (
    <ProductModalShell>
      <ProductDetailContent product={product} variant="modal" />
    </ProductModalShell>
  );
}
