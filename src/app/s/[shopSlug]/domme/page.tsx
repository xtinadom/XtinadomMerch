import { redirect } from "next/navigation";

type Props = { params: Promise<{ shopSlug: string }> };

export default async function ShopTenantDommeRedirectPage({ params }: Props) {
  const { shopSlug } = await params;
  redirect(`/s/${shopSlug}/all`);
}
