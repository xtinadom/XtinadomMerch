import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function ShopDommeTagRedirectPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/shop/tag/${slug}`);
}
