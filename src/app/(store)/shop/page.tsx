import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy `/shop` entry — home lists both collections. */
export default function ShopRootRedirect() {
  redirect("/");
}
