import { CatalogGroup } from "@/generated/prisma/enums";
import { resolveRootCatalogGroup } from "@/lib/catalog-group";

/** Slugs + parent links (optional catalogGroup for collection checks). */
export type CategoryGraphNode = {
  id: string;
  slug: string;
  parentId: string | null;
  catalogGroup?: CatalogGroup | null;
};

/** Full row for admin selects and tree walks. */
export type CategoryNode = CategoryGraphNode & {
  name: string;
  sortOrder: number;
};

export function categoryByIdMap(categories: CategoryGraphNode[]): Map<string, CategoryGraphNode> {
  return new Map(categories.map((c) => [c.id, c]));
}

/** Top-level ancestor for a category (walks up via parentId). */
export function getCategoryRoot(
  categoryId: string,
  byId: Map<string, CategoryNode>,
): CategoryNode | undefined {
  let c = byId.get(categoryId);
  if (!c) return undefined;
  while (c.parentId) {
    const p = byId.get(c.parentId);
    if (!p) return c;
    c = p;
  }
  return c;
}

/** Walk up from categoryId; return true if any ancestor (including self) has slug in set. */
export function categoryTouchesSlugSet(
  categoryId: string,
  byId: Map<string, CategoryGraphNode>,
  slugSet: Set<string>,
): boolean {
  let id: string | null = categoryId;
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const c = byId.get(id);
    if (!c) return false;
    if (slugSet.has(c.slug)) return true;
    id = c.parentId;
  }
  return false;
}

/** BFS from root ids downward (includes roots). */
export function collectDescendantCategoryIdsFromRoots(
  rootIds: string[],
  all: CategoryGraphNode[],
): string[] {
  const out = new Set<string>(rootIds);
  const queue = [...rootIds];
  while (queue.length) {
    const pid = queue.shift()!;
    for (const c of all) {
      if (c.parentId === pid && !out.has(c.id)) {
        out.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return [...out];
}

/** True if category’s tree root is in the Domme collection. */
export function categoryInDommeBranch(
  categoryId: string,
  byId: Map<string, CategoryNode>,
): boolean {
  const root = getCategoryRoot(categoryId, byId);
  if (!root) return false;
  return resolveRootCatalogGroup(root) === CatalogGroup.domme;
}

/** All category ids that are entry slugs or descendants of those nodes (BFS downward). */
export function collectDescendantCategoryIds(
  entrySlugs: Set<string>,
  all: CategoryGraphNode[],
): string[] {
  const rootIds = all.filter((c) => !c.parentId && entrySlugs.has(c.slug)).map((c) => c.id);
  return collectDescendantCategoryIdsFromRoots(rootIds, all);
}
