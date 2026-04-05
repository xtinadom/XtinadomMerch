import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PERSONA_COOKIE,
  SHOP_DOMME_ROUTE,
  SHOP_SUB_ROUTE,
  isPersona,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ShopRedirectPage() {
  const jar = await cookies();
  const raw = jar.get(PERSONA_COOKIE)?.value;
  const persona = isPersona(raw) ? raw : null;
  if (persona === "domme") redirect(SHOP_DOMME_ROUTE);
  redirect(SHOP_SUB_ROUTE);
}
