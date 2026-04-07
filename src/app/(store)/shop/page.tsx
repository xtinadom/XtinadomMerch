import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** `/shop` → full catalog (same as home “All products”). */
export default function ShopRootRedirect() {
  redirect("/shop/all");
}
