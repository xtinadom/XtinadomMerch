"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  adminDeleteCatalogItem,
  adminLinkCatalogItemTag,
  adminUnlinkCatalogItemTag,
  adminUpdateCatalogItem,
} from "@/actions/admin-catalog-items";
import { dollarsStringFromCents, validateItemLevelWhenNoVariants } from "@/lib/admin-catalog-item";
import { AdminCatalogArtworkRequirementFields } from "@/components/admin/AdminCatalogArtworkRequirementFields";
import { AdminCatalogItemLevelFields } from "@/components/admin/AdminCatalogItemLevelFields";
import { parseAdminCatalogArtworkRequirement } from "@/lib/admin-catalog-item";

export type AdminListItemTag = {
  id: string;
  name: string;
  slug: string;
};

export type AdminListItemSerializable = {
  id: string;
  name: string;
  itemPlatformProductId: string | null;
  itemExampleListingUrl: string | null;
  itemMinPriceCents: number;
  itemGoodsServicesCostCents: number;
  itemImageRequirementLabel: string | null;
  itemMinArtworkLongEdgePx: number | null;
  tags: AdminListItemTag[];
};

export type AdminListTagOption = {
  id: string;
  name: string;
  slug: string;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function minPriceDisplayText(minPriceCents: number, exampleUrl: string) {
  if (minPriceCents === 0 && !exampleUrl.trim()) return "—";
  return formatMoney(minPriceCents);
}

function AdminCatalogItemTagsDisplayCell({ tags }: { tags: AdminListItemTag[] }) {
  return (
    <td className="max-w-[14rem] p-3 align-top text-zinc-300">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex max-w-full rounded-full border border-zinc-600 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-200"
            title={t.name}
          >
            <span className="min-w-0 truncate">{t.name}</span>
          </span>
        ))}
        {tags.length === 0 ? <span className="text-[11px] text-zinc-600">—</span> : null}
      </div>
    </td>
  );
}

function AdminCatalogItemTagsEditor({
  itemId,
  linkedTags,
  allTags,
}: {
  itemId: string;
  linkedTags: AdminListItemTag[];
  allTags: AdminListTagOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pick, setPick] = useState("");

  const linkedIds = new Set(linkedTags.map((t) => t.id));
  const available = allTags.filter((t) => !linkedIds.has(t.id));

  function addTag() {
    if (!pick) return;
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("tagId", pick);
    startTransition(async () => {
      await adminLinkCatalogItemTag(fd);
      setPick("");
      router.refresh();
    });
  }

  function removeTag(tagId: string) {
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("tagId", tagId);
    startTransition(async () => {
      await adminUnlinkCatalogItemTag(fd);
      router.refresh();
    });
  }

  return (
    <div className="mt-2 border-t border-zinc-800 pt-4">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Tags</h4>
      <p className="mt-1 text-[11px] text-zinc-600">
        Tags control storefront browse for baseline-linked listings. Changes save immediately.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {linkedTags.map((t) => (
          <span
            key={t.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-600 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-200"
          >
            <span className="min-w-0 truncate" title={t.name}>
              {t.name}
            </span>
            <button
              type="button"
              disabled={pending}
              title={`Remove “${t.name}” from this item`}
              className="shrink-0 text-zinc-500 hover:text-rose-300 disabled:opacity-50"
              onClick={() => removeTag(t.id)}
            >
              ×
            </button>
          </span>
        ))}
        {linkedTags.length === 0 ? <span className="text-[11px] text-zinc-600">No tags linked.</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          disabled={pending || available.length === 0}
          aria-label="Add tag to this catalog item"
          className="min-w-0 max-w-xs flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
        >
          <option value="">Add tag…</option>
          {available.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addTag}
          disabled={pending || !pick}
          className="shrink-0 rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Add tag
        </button>
      </div>
      {allTags.length === 0 ? (
        <p className="mt-3 text-[11px] text-amber-200/80">
          No tags exist yet — add some on the{" "}
          <Link href="/admin/backend?tab=tags" className="text-amber-100/90 underline-offset-2 hover:underline">
            Tags
          </Link>{" "}
          tab first.
        </p>
      ) : (
        <p className="mt-3 text-[11px] leading-snug text-zinc-600">
          <Link href="/admin/backend?tab=tags" className="text-blue-400/80 hover:underline">
            Create or rename tags
          </Link>{" "}
          on the Tags tab.
        </p>
      )}
    </div>
  );
}

function exampleLink(url: string) {
  const t = url.trim();
  if (!t) return null;
  const href = t.startsWith("/") ? t : t;
  const isAbsolute = /^https?:\/\//i.test(t);
  if (isAbsolute) {
    return (
      <a
        href={t}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-blue-400/90 hover:underline"
      >
        {t.length > 48 ? `${t.slice(0, 46)}…` : t}
      </a>
    );
  }
  return (
    <Link href={href} className="break-all text-blue-400/90 hover:underline">
      {t}
    </Link>
  );
}

export function AdminListItemsPanel({
  items,
  allTags,
}: {
  items: AdminListItemSerializable[];
  allTags: AdminListTagOption[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editItemExampleListingUrl, setEditItemExampleListingUrl] = useState("");
  const [editItemMinPriceDollars, setEditItemMinPriceDollars] = useState("");
  const [editItemGoodsServicesCostDollars, setEditItemGoodsServicesCostDollars] = useState("");
  const [editItemImageRequirementLabel, setEditItemImageRequirementLabel] = useState("");
  const [editItemMinArtworkLongEdgePx, setEditItemMinArtworkLongEdgePx] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ itemId: string; itemName: string } | null>(
    null,
  );

  useEffect(() => {
    if (!deleteDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deletePending) setDeleteDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteDialog, deletePending]);

  function openDeleteCatalogItemDialog(itemId: string, itemName: string) {
    setDeleteDialog({ itemId, itemName });
  }

  function closeDeleteCatalogItemDialog() {
    if (deletePending) return;
    setDeleteDialog(null);
  }

  function confirmDeleteCatalogItemFromDialog() {
    if (!deleteDialog || deletePending) return;
    const { itemId } = deleteDialog;
    const fd = new FormData();
    fd.set("itemId", itemId);
    setDeletingItemId(itemId);
    startDeleteTransition(async () => {
      try {
        await adminDeleteCatalogItem(fd);
        if (editingId === itemId) cancelEdit();
        router.refresh();
      } finally {
        setDeletingItemId(null);
        setDeleteDialog(null);
      }
    });
  }

  function beginEditItem(itemId: string) {
    const item = items.find((x) => x.id === itemId);
    if (!item) return;
    setEditName(item.name);
    setEditItemExampleListingUrl(item.itemExampleListingUrl ?? "");
    setEditItemMinPriceDollars(dollarsStringFromCents(item.itemMinPriceCents));
    setEditItemGoodsServicesCostDollars(dollarsStringFromCents(item.itemGoodsServicesCostCents));
    setEditItemImageRequirementLabel(item.itemImageRequirementLabel ?? "");
    setEditItemMinArtworkLongEdgePx(
      item.itemMinArtworkLongEdgePx != null ? String(item.itemMinArtworkLongEdgePx) : "",
    );
    setEditError(null);
    setEditingId(itemId);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditItemExampleListingUrl("");
    setEditItemMinPriceDollars("");
    setEditItemGoodsServicesCostDollars("");
    setEditItemImageRequirementLabel("");
    setEditItemMinArtworkLongEdgePx("");
    setEditError(null);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);
    const name = editName.trim();
    if (!name) {
      setEditError("Enter an item name.");
      return;
    }
    const itemLevel = validateItemLevelWhenNoVariants(
      editItemExampleListingUrl,
      editItemMinPriceDollars,
      editItemGoodsServicesCostDollars,
    );
    if (!itemLevel.ok) {
      setEditError(itemLevel.error);
      return;
    }
    const ar = parseAdminCatalogArtworkRequirement(
      editItemImageRequirementLabel,
      editItemMinArtworkLongEdgePx,
    );
    if (!ar.ok) {
      setEditError(ar.error);
      return;
    }
    const fd = new FormData();
    fd.set("itemId", editingId);
    fd.set("itemName", name);
    fd.set("itemExampleListingUrl", editItemExampleListingUrl);
    fd.set("itemMinPriceDollars", editItemMinPriceDollars);
    fd.set("itemGoodsServicesCostDollars", editItemGoodsServicesCostDollars);
    fd.set("itemImageRequirementLabel", editItemImageRequirementLabel);
    fd.set("itemMinArtworkLongEdgePx", editItemMinArtworkLongEdgePx);
    startTransition(async () => {
      await adminUpdateCatalogItem(fd);
      cancelEdit();
      router.refresh();
    });
  }

  const editingItem = editingId ? items.find((x) => x.id === editingId) : null;

  return (
    <>
      {editingId && editingItem ? (
        <div className="mb-6 rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-amber-200/80">
            Edit item
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500">Updating “{editingItem.name}”</p>
          <form onSubmit={submitEdit} className="mt-4 space-y-4">
            <label className="block text-xs text-zinc-500">
              Item name
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                maxLength={300}
                className="mt-1 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
            <AdminCatalogItemLevelFields
              exampleListingUrl={editItemExampleListingUrl}
              minPriceDollars={editItemMinPriceDollars}
              goodsServicesCostDollars={editItemGoodsServicesCostDollars}
              onChangeExampleListingUrl={setEditItemExampleListingUrl}
              onChangeMinPriceDollars={setEditItemMinPriceDollars}
              onChangeGoodsServicesCostDollars={setEditItemGoodsServicesCostDollars}
            />
            <AdminCatalogArtworkRequirementFields
              imageRequirementLabel={editItemImageRequirementLabel}
              minLongEdgePx={editItemMinArtworkLongEdgePx}
              onChangeImageRequirementLabel={setEditItemImageRequirementLabel}
              onChangeMinLongEdgePx={setEditItemMinArtworkLongEdgePx}
            />
            {editError ? (
              <p className="text-xs text-amber-200/90" role="alert">
                {editError}
              </p>
            ) : null}
            <AdminCatalogItemTagsEditor
              key={editingId}
              itemId={editingId}
              linkedTags={editingItem.tags}
              allTags={allTags}
            />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={cancelEdit}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full min-w-[48rem] text-left text-xs">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="p-3 font-medium">Item name</th>
              <th className="p-3 font-medium">Tags</th>
              <th className="p-3 font-medium">Example listing</th>
              <th className="p-3 font-medium whitespace-nowrap" title="Goods/services fulfillment cost per unit">
                G/S cost
              </th>
              <th className="p-3 font-medium whitespace-nowrap">Min price</th>
              <th className="p-3 font-medium max-w-[12rem]">Artwork / DPI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/90 text-zinc-300">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="p-3 font-medium text-zinc-200">
                  <div>{item.name}</div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                    <button
                      type="button"
                      onClick={() => beginEditItem(item.id)}
                      className="text-[11px] text-blue-400/90 hover:underline"
                    >
                      Edit item
                    </button>
                    <button
                      type="button"
                      disabled={deletePending || deleteDialog !== null}
                      onClick={() => openDeleteCatalogItemDialog(item.id, item.name)}
                      className="text-[11px] text-blue-400/90 hover:underline disabled:opacity-50"
                      title="Delete this catalog item"
                    >
                      {deletingItemId === item.id ? "Deleting…" : "Delete item"}
                    </button>
                  </div>
                </td>
                <AdminCatalogItemTagsDisplayCell tags={item.tags} />
                <td className="p-3 text-zinc-400">
                  {item.itemExampleListingUrl ? (
                    exampleLink(item.itemExampleListingUrl)
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap tabular-nums text-zinc-400">
                  {formatMoney(item.itemGoodsServicesCostCents)}
                </td>
                <td className="p-3 whitespace-nowrap tabular-nums text-zinc-400">
                  {minPriceDisplayText(item.itemMinPriceCents, item.itemExampleListingUrl ?? "")}
                </td>
                <td className="max-w-[12rem] p-3 align-top text-zinc-400">
                  {item.itemMinArtworkLongEdgePx != null && item.itemMinArtworkLongEdgePx > 0 ? (
                    <div className="text-[11px] leading-relaxed">
                      {item.itemImageRequirementLabel?.trim() ? (
                        <p className="text-zinc-300">{item.itemImageRequirementLabel.trim()}</p>
                      ) : null}
                      <p className="mt-0.5 tabular-nums text-zinc-500">Min long edge: {item.itemMinArtworkLongEdgePx}px</p>
                    </div>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No items yet — use List item above.</p>
      ) : null}

      {deleteDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-delete-catalog-item-title"
          onClick={closeDeleteCatalogItemDialog}
        >
          <div
            className="max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="admin-delete-catalog-item-title"
              className="text-base font-semibold text-zinc-100"
            >
              Delete catalog item?
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              This will remove{" "}
              <span className="font-medium text-zinc-200">
                “{(deleteDialog.itemName.trim() || "this item").slice(0, 200)}”
              </span>{" "}
              from the baseline list. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={deletePending}
                onClick={closeDeleteCatalogItemDialog}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletePending}
                onClick={confirmDeleteCatalogItemFromDialog}
                className="rounded-lg border border-red-900/60 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-950/70 disabled:opacity-50"
              >
                {deletePending ? "Deleting…" : "Delete item"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
