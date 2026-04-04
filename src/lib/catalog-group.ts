import { CatalogGroup } from "@/generated/prisma/enums";
import {
  DOMME_COLLECTION_SLUGS,
  SUB_CATALOG_CATEGORY_SLUGS,
  dommeCollectionSortIndex,
  subCatalogParentSortIndex,
} from "@/lib/constants";

export type CatalogRootLike = {
  id: string;
  slug: string;
  parentId: string | null;
  catalogGroup: CatalogGroup | null;
};

/** For root rows: explicit catalogGroup, else legacy slug sets. */
export function resolveRootCatalogGroup(root: {
  slug: string;
  parentId: string | null;
  catalogGroup?: CatalogGroup | null;
}): CatalogGroup | null {
  if (root.parentId !== null) return null;
  if (root.catalogGroup != null) return root.catalogGroup;
  if (SUB_CATALOG_CATEGORY_SLUGS.has(root.slug)) return CatalogGroup.sub;
  if (DOMME_COLLECTION_SLUGS.has(root.slug)) return CatalogGroup.domme;
  return null;
}

export function catalogRootIdsForGroup(
  group: CatalogGroup,
  all: CatalogRootLike[],
): string[] {
  return all
    .filter((c) => c.parentId === null && resolveRootCatalogGroup(c) === group)
    .map((c) => c.id);
}

export type CategoryNavRow = CatalogRootLike & {
  name: string;
  sortOrder: number;
};

export function sortSubRootCategories(roots: CategoryNavRow[]): CategoryNavRow[] {
  return [...roots].sort(
    (a, b) =>
      subCatalogParentSortIndex(a.slug) - subCatalogParentSortIndex(b.slug) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name),
  );
}

export function sortDommeRootCategories(roots: CategoryNavRow[]): CategoryNavRow[] {
  return [...roots].sort(
    (a, b) =>
      dommeCollectionSortIndex(a.slug) - dommeCollectionSortIndex(b.slug) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name),
  );
}
