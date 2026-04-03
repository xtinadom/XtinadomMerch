/** Category slugs that qualify for optional tips at checkout (sub catalog). */
export const TIP_ELIGIBLE_CATEGORY_SLUGS = new Set(["photo-printed", "used"]);

/** Sub catalog category slugs — not listed on /shop for domme persona (open via Categories menu). */
export const SUB_CATALOG_CATEGORY_SLUGS = new Set(["photo-printed", "used"]);

/** Nav label for grouped sub-catalog links in the header menu. */
export const SUB_COLLECTION_NAV_LABEL = "Sub collection";

/** Combined listing for all sub-catalog categories (photo-printed, used). */
export const SUB_COLLECTION_ROUTE = "/collection/sub";

/** Valid `group` segment for `/collection/[group]`. */
export const COLLECTION_GROUP_SUB = "sub" as const;

/** Domme collection child category slugs (nav parent: “Domme collection”). */
export const DOMME_COLLECTION_SLUGS = new Set([
  "domme-mugs",
  "domme-tees",
  "domme-website-services",
]);

export const DOMME_COLLECTION_NAV_LABEL = "Domme collection";

/** Combined listing for all Domme collection categories. */
export const DOMME_COLLECTION_ROUTE = "/collection/domme";

export const COLLECTION_GROUP_DOMME = "domme" as const;

/** Sort order for domme children in nav and domme /shop view. */
export const DOMME_COLLECTION_SLUG_ORDER: readonly string[] = [
  "domme-mugs",
  "domme-tees",
  "domme-website-services",
];

export function dommeCollectionSortIndex(slug: string): number {
  const i = DOMME_COLLECTION_SLUG_ORDER.indexOf(slug);
  return i === -1 ? 999 : i;
}

export const PERSONA_COOKIE = "xtina_persona";

export type Persona = "sub" | "domme";

export function isPersona(v: string | undefined): v is Persona {
  return v === "sub" || v === "domme";
}
