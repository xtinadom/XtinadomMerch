import { Audience } from "@/generated/prisma/enums";

/** Form field names for product collection checkboxes (used in admin). */
export const COLLECTION_SUB_FIELD = "collectionSub";
export const COLLECTION_DOMME_FIELD = "collectionDomme";

export function parseCollectionAssignmentFromForm(formData: FormData): {
  sub: boolean;
  domme: boolean;
} {
  return {
    sub: formData.get(COLLECTION_SUB_FIELD) === "on",
    domme: formData.get(COLLECTION_DOMME_FIELD) === "on",
  };
}

/** Maps Sub / Domme toggles to stored audience. */
export function audienceFromCollectionAssignment(
  sub: boolean,
  domme: boolean,
): Audience | null {
  if (sub && domme) return Audience.both;
  if (sub) return Audience.sub;
  if (domme) return Audience.domme;
  return null;
}

export function collectionAssignmentFromAudience(audience: Audience): {
  sub: boolean;
  domme: boolean;
} {
  return {
    sub: audience === Audience.sub || audience === Audience.both,
    domme: audience === Audience.domme || audience === Audience.both,
  };
}
