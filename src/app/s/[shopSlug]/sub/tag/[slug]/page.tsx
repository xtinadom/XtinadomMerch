import { redirect } from "next/navigation";

type Props = { params: Promise<{ shopSlug: string; slug: string }> };

export default async function ShopTenantSubTagRedirectPage({ params }: Props) {
  const { shopSlug, slug } = await params;
  redirect(`/s/${shopSlug}/tag/${slug}`);
}
