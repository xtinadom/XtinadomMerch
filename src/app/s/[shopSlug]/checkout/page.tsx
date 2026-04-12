import { redirect } from "next/navigation";
import { shopCartHref } from "@/lib/marketplace-constants";

type Props = { params: Promise<{ shopSlug: string }> };

export default async function ShopTenantCheckoutPage({ params }: Props) {
  const { shopSlug } = await params;
  redirect(shopCartHref(shopSlug));
}
