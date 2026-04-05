export const SHOP_SUB_ROUTE = "/shop/sub";
export const SHOP_DOMME_ROUTE = "/shop/domme";

export const SUB_SHOP_NAV_LABEL = "Sub shop";
export const DOMME_SHOP_NAV_LABEL = "Domme shop";

export const PERSONA_COOKIE = "xtina_persona";

export type Persona = "sub" | "domme";

export function isPersona(v: string | undefined): v is Persona {
  return v === "sub" || v === "domme";
}
