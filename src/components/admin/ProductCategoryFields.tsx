"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CatalogGroup } from "@/generated/prisma/enums";
import type { CategoryNode } from "@/lib/category-tree";
import { getCategoryRoot } from "@/lib/category-tree";
import { resolveRootCatalogGroup } from "@/lib/catalog-group";
import {
  adminCreateParentCategory,
  adminCreateSubcategory,
  adminUpdateCategory,
  adminDeleteCategory,
} from "@/actions/admin-categories";

export type AdminCategoryRow = CategoryNode & {
  description: string | null;
  catalogGroup: CatalogGroup | null;
};

export type ProductCategoryFieldsVariant = "all" | "subOnly";

type Props = {
  categories: AdminCategoryRow[];
  defaultCategoryIds: string[];
  variant?: ProductCategoryFieldsVariant;
};

function categoryOptionLabel(
  c: AdminCategoryRow,
  byId: Map<string, AdminCategoryRow>,
): string {
  if (!c.parentId) return c.name;
  const p = byId.get(c.parentId);
  return p ? `${p.name} → ${c.name}` : c.name;
}

function initialCatalogSide(
  variant: ProductCategoryFieldsVariant,
  defaultCategoryIds: string[],
  byId: Map<string, AdminCategoryRow>,
): CatalogGroup {
  if (variant === "subOnly") return CatalogGroup.sub;
  const first = defaultCategoryIds[0];
  if (!first) return CatalogGroup.sub;
  const root = getCategoryRoot(first, byId);
  const g = root ? resolveRootCatalogGroup(root) : null;
  if (g === CatalogGroup.domme) return CatalogGroup.domme;
  return CatalogGroup.sub;
}

function filterTagIdsForSide(
  ids: string[],
  side: CatalogGroup,
  byId: Map<string, AdminCategoryRow>,
): string[] {
  return ids.filter((id) => {
    const root = getCategoryRoot(id, byId);
    return root && resolveRootCatalogGroup(root) === side;
  });
}

type DialogState =
  | { open: false }
  | { open: true; mode: "addCategory" }
  | { open: true; mode: "editCategory"; categoryId: string };

export function ProductCategoryFields({
  categories,
  defaultCategoryIds,
  variant = "all",
}: Props) {
  const router = useRouter();
  const byId = useMemo(
    () => new Map<string, AdminCategoryRow>(categories.map((c) => [c.id, c])),
    [categories],
  );

  const [catalogSide, setCatalogSide] = useState<CatalogGroup>(() =>
    initialCatalogSide(variant, defaultCategoryIds, byId),
  );
  const [tagIds, setTagIds] = useState<string[]>(() => [...new Set(defaultCategoryIds)]);
  const [pickId, setPickId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [dialogError, setDialogError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  /** New category dialog: top-level vs under parent */
  const [createPlacement, setCreatePlacement] = useState<"top" | "sub">("top");
  const [createParentId, setCreateParentId] = useState("");

  const parentRoots = useMemo(() => {
    return categories
      .filter(
        (c) =>
          c.parentId === null && resolveRootCatalogGroup(c) === catalogSide,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [categories, catalogSide]);

  const taggableCategories = useMemo(() => {
    return categories
      .filter((c) => {
        const root = getCategoryRoot(c.id, byId);
        if (!root) return false;
        const g = resolveRootCatalogGroup(root);
        if (variant === "subOnly") return g === CatalogGroup.sub;
        return g === catalogSide;
      })
      .sort((a, b) =>
        categoryOptionLabel(a, byId).localeCompare(categoryOptionLabel(b, byId)),
      );
  }, [categories, byId, variant, catalogSide]);

  useEffect(() => {
    if (dialog.open) {
      dialogRef.current?.showModal();
      setDialogError(null);
      if (dialog.mode === "addCategory") {
        setCreatePlacement("top");
        setCreateParentId(parentRoots[0]?.id ?? "");
      }
    } else {
      dialogRef.current?.close();
    }
  }, [dialog, parentRoots]);

  async function handleDialogSubmit(
    action: (fd: FormData) => Promise<
      { ok: true; id?: string } | { ok: false; error: string }
    >,
    form: HTMLFormElement,
    opts?: { onSuccess?: (id: string) => void },
  ) {
    setDialogError(null);
    const fd = new FormData(form);
    const r = await action(fd);
    if (!r.ok) {
      setDialogError(r.error);
      return;
    }
    setDialog({ open: false });
    if (r.ok && r.id && opts?.onSuccess) opts.onSuccess(r.id);
    router.refresh();
  }

  async function deleteCategoryFromStore(id: string, label: string) {
    if (!confirm(`Delete category “${label}” from the store? Products must be reassigned first.`))
      return;
    setMessage(null);
    const fd = new FormData();
    fd.set("categoryId", id);
    const r = await adminDeleteCategory(fd);
    if (!r.ok) {
      setMessage(r.error);
      return;
    }
    setTagIds((prev) => prev.filter((x) => x !== id));
    setDialog({ open: false });
    router.refresh();
  }

  const editingCategory =
    dialog.open && dialog.mode === "editCategory"
      ? byId.get(dialog.categoryId)
      : undefined;

  function openEditCategory(categoryId: string) {
    setDialog({ open: true, mode: "editCategory", categoryId });
  }

  function addPickedTag() {
    if (!pickId || tagIds.includes(pickId)) return;
    setTagIds((t) => [...t, pickId]);
    setPickId("");
    setMessage(null);
  }

  return (
    <div className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      {tagIds.map((id) => (
        <input key={id} type="hidden" name="categoryIds" value={id} />
      ))}

      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Category
      </h3>

      {message ? (
        <p className="rounded-md border border-amber-900/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
          {message}
        </p>
      ) : null}

      {/* —— Collection —— */}
      <section className="space-y-3" aria-labelledby="collection-heading">
        <div>
          <h4 id="collection-heading" className="text-sm font-medium text-zinc-100">
            Collection
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Choose which storefront collection you are tagging in. Only categories from this
            collection appear below.
          </p>
        </div>
        {variant === "all" ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCatalogSide(CatalogGroup.sub);
                setTagIds((prev) => filterTagIdsForSide(prev, CatalogGroup.sub, byId));
                setPickId("");
                setMessage(null);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                catalogSide === CatalogGroup.sub
                  ? "bg-rose-900/45 text-rose-50 ring-2 ring-rose-600/50"
                  : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              Sub
            </button>
            <button
              type="button"
              onClick={() => {
                setCatalogSide(CatalogGroup.domme);
                setTagIds((prev) => filterTagIdsForSide(prev, CatalogGroup.domme, byId));
                setPickId("");
                setMessage(null);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                catalogSide === CatalogGroup.domme
                  ? "bg-rose-900/45 text-rose-50 ring-2 ring-rose-600/50"
                  : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              Domme
            </button>
          </div>
        ) : (
          <p className="rounded-lg bg-zinc-900/50 px-3 py-2 text-sm text-zinc-400 ring-1 ring-zinc-800">
            Sub collection
          </p>
        )}
      </section>

      {/* —— Tags —— */}
      <section
        className="space-y-4 border-t border-zinc-800 pt-6"
        aria-labelledby="tags-heading"
      >
        <div>
          <h4 id="tags-heading" className="text-sm font-medium text-zinc-100">
            Tags
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Add as many categories as you want. The first tag is the primary category (product card
            and default links). Create new categories, edit names or slugs, remove a tag from this
            product, or delete a category from the whole store.
          </p>
        </div>

        {tagIds.length === 0 ? (
          <p className="rounded-md border border-amber-900/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/80">
            Add at least one tag before saving the product.
          </p>
        ) : (
          <ul className="space-y-2">
            {tagIds.map((id, i) => {
              const c = byId.get(id);
              if (!c) return null;
              return (
                <li
                  key={id}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-200">
                    {i === 0 ? (
                      <span className="shrink-0 rounded bg-rose-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200/90">
                        Primary
                      </span>
                    ) : null}
                    <span>{categoryOptionLabel(c, byId)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditCategory(id)}
                      className="rounded-md border border-zinc-600 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setTagIds((t) => t.filter((x) => x !== id))}
                      className="rounded-md border border-zinc-600 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Remove tag
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block min-w-[12rem] flex-1 text-xs text-zinc-500">
            Add tag
            <select
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">Select category…</option>
              {taggableCategories.map((c) => (
                <option key={c.id} value={c.id} disabled={tagIds.includes(c.id)}>
                  {categoryOptionLabel(c, byId)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addPickedTag}
            disabled={!pickId || tagIds.includes(pickId)}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add tag
          </button>
          <button
            type="button"
            onClick={() => setDialog({ open: true, mode: "addCategory" })}
            className="rounded-lg border border-emerald-900/50 bg-emerald-950/35 px-4 py-2 text-sm font-medium text-emerald-100/90 hover:bg-emerald-950/50"
          >
            New category
          </button>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        className="max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 shadow-2xl backdrop:bg-black/70"
        onClose={() => setDialog({ open: false })}
      >
        {dialog.open && dialog.mode === "addCategory" ? (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-zinc-50">New category</h3>
            <p className="text-xs text-zinc-500">
              Top-level categories belong to the current collection ({catalogSide}). Subcategories
              sit under a parent you choose.
            </p>
            <div className="space-y-2 text-xs text-zinc-400">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="placement"
                  checked={createPlacement === "top"}
                  onChange={() => setCreatePlacement("top")}
                  className="border-zinc-600"
                />
                Top-level category
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="placement"
                  checked={createPlacement === "sub"}
                  onChange={() => setCreatePlacement("sub")}
                  className="border-zinc-600"
                />
                Subcategory of…
              </label>
              {createPlacement === "sub" ? (
                <select
                  value={createParentId}
                  onChange={(e) => setCreateParentId(e.target.value)}
                  className="ml-6 mt-1 block w-[calc(100%-1.5rem)] rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                >
                  {parentRoots.length === 0 ? (
                    <option value="">No parents in this collection yet</option>
                  ) : null}
                  {parentRoots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {createPlacement === "top" ? (
              <form
                className="space-y-3 border-t border-zinc-800 pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleDialogSubmit(adminCreateParentCategory, e.currentTarget, {
                    onSuccess: (newId) =>
                      setTagIds((prev) =>
                        prev.includes(newId) ? prev : [...prev, newId],
                      ),
                  });
                }}
              >
                <input type="hidden" name="catalogGroup" value={catalogSide} />
                <label className="block text-xs text-zinc-500">
                  Name
                  <input
                    name="name"
                    required
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Slug (optional)
                  <input
                    name="slug"
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Sort order
                  <input
                    name="sortOrder"
                    type="number"
                    defaultValue={0}
                    className="mt-1 block w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Description (optional)
                  <textarea
                    name="description"
                    rows={2}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                </label>
                {dialogError ? (
                  <p className="text-xs text-rose-400">{dialogError}</p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                    onClick={() => setDialog({ open: false })}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-900/70 px-4 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800/80"
                  >
                    Create &amp; tag
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="space-y-3 border-t border-zinc-800 pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!createParentId) {
                    setDialogError("Choose a parent category.");
                    return;
                  }
                  handleDialogSubmit(adminCreateSubcategory, e.currentTarget, {
                    onSuccess: (newId) =>
                      setTagIds((prev) =>
                        prev.includes(newId) ? prev : [...prev, newId],
                      ),
                  });
                }}
              >
                <input type="hidden" name="parentId" value={createParentId} />
                <label className="block text-xs text-zinc-500">
                  Name
                  <input
                    name="name"
                    required
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Slug (optional)
                  <input
                    name="slug"
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Sort order
                  <input
                    name="sortOrder"
                    type="number"
                    defaultValue={0}
                    className="mt-1 block w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Description (optional)
                  <textarea
                    name="description"
                    rows={2}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  />
                </label>
                {dialogError ? (
                  <p className="text-xs text-rose-400">{dialogError}</p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                    onClick={() => setDialog({ open: false })}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!createParentId}
                    className="rounded-lg bg-emerald-900/70 px-4 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800/80 disabled:opacity-40"
                  >
                    Create &amp; tag
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}

        {dialog.open && dialog.mode === "editCategory" && editingCategory ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleDialogSubmit(adminUpdateCategory, e.currentTarget);
            }}
          >
            <h3 className="text-base font-medium text-zinc-50">Edit category</h3>
            <input type="hidden" name="categoryId" value={editingCategory.id} />
            <label className="block text-xs text-zinc-500">
              Name
              <input
                name="name"
                required
                defaultValue={editingCategory.name}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Slug
              <input
                name="slug"
                required
                defaultValue={editingCategory.slug}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Sort order
              <input
                name="sortOrder"
                type="number"
                defaultValue={editingCategory.sortOrder}
                className="mt-1 block w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Description (optional)
              <textarea
                name="description"
                rows={2}
                defaultValue={editingCategory.description ?? ""}
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              />
            </label>
            {!editingCategory.parentId ? (
              <label className="block text-xs text-zinc-500">
                Collection
                <select
                  name="catalogGroup"
                  required
                  defaultValue={
                    editingCategory.catalogGroup ??
                    (resolveRootCatalogGroup(editingCategory) === CatalogGroup.domme
                      ? "domme"
                      : "sub")
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                >
                  <option value="sub">Sub</option>
                  <option value="domme">Domme</option>
                </select>
              </label>
            ) : null}
            {dialogError ? (
              <p className="text-xs text-rose-400">{dialogError}</p>
            ) : null}
            <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                  onClick={() => setDialog({ open: false })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-900/70 px-4 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800/80"
                >
                  Save
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  deleteCategoryFromStore(editingCategory.id, editingCategory.name)
                }
                className="w-full rounded-lg border border-rose-900/50 bg-rose-950/30 py-2 text-xs text-rose-300 hover:bg-rose-950/45"
              >
                Delete category from store
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </div>
  );
}
