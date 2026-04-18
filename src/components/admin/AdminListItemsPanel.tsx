"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adminDeleteCatalogItem,
  adminUpdateCatalogItem,
  adminUpdateCatalogMinPrice,
} from "@/actions/admin-catalog-items";
import type { AdminCatalogVariant, AdminCatalogVariantFormRow } from "@/lib/admin-catalog-item";
import {
  dollarsStringFromCents,
  validateCatalogVariantFormRows,
  validateItemLevelWhenNoVariants,
  variantsToFormRows,
} from "@/lib/admin-catalog-item";
import { AdminCatalogVariantRowsEditor } from "@/components/admin/AdminCatalogVariantRowsEditor";
import { AdminCatalogItemLevelFields } from "@/components/admin/AdminCatalogItemLevelFields";

export type AdminListItemSerializable = {
  id: string;
  name: string;
  variants: AdminCatalogVariant[];
  itemPlatformProductId: string | null;
  itemExampleListingUrl: string | null;
  itemMinPriceCents: number;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function minPriceDisplayText(r: {
  variantLabel: string;
  minPriceCents: number;
  exampleUrl: string;
}) {
  if (r.variantLabel === "—") {
    return r.minPriceCents === 0 && !r.exampleUrl.trim()
      ? "—"
      : formatMoney(r.minPriceCents);
  }
  return r.minPriceCents > 0 ? formatMoney(r.minPriceCents) : "—";
}

function AdminMinPriceCell({
  itemId,
  variantId,
  variantIndex,
  variantLabel,
  minPriceCents,
  exampleUrl,
}: {
  itemId: string;
  variantId: string | null;
  variantIndex: number;
  variantLabel: string;
  minPriceCents: number;
  exampleUrl: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("minPriceDollars", draft);
    if (variantId) fd.set("variantId", variantId);
    fd.set("variantIndex", String(variantIndex));
    startTransition(async () => {
      await adminUpdateCatalogMinPrice(fd);
      setEditing(false);
      router.refresh();
    });
  }

  const display = minPriceDisplayText({ variantLabel, minPriceCents, exampleUrl });

  return (
    <td className="p-3 whitespace-nowrap tabular-nums text-zinc-400">
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            disabled={pending}
            className="w-[7rem] rounded border border-zinc-600 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="text-[11px] text-blue-400/90 hover:underline disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="text-[11px] text-zinc-500 hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span>{display}</span>
          <button
            type="button"
            onClick={() => {
              setDraft(dollarsStringFromCents(minPriceCents));
              setEditing(true);
            }}
            className="text-left text-[11px] text-blue-400/90 hover:underline"
          >
            Edit min price
          </button>
        </div>
      )}
    </td>
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

export function AdminListItemsPanel({ items }: { items: AdminListItemSerializable[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editVariants, setEditVariants] = useState<AdminCatalogVariantFormRow[]>([]);
  const [editItemExampleListingUrl, setEditItemExampleListingUrl] = useState("");
  const [editItemMinPriceDollars, setEditItemMinPriceDollars] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function beginEditItem(itemId: string) {
    const item = items.find((x) => x.id === itemId);
    if (!item) return;
    setEditName(item.name);
    setEditVariants(variantsToFormRows(item.variants));
    setEditItemExampleListingUrl(item.itemExampleListingUrl ?? "");
    setEditItemMinPriceDollars(dollarsStringFromCents(item.itemMinPriceCents));
    setEditError(null);
    setEditingId(itemId);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditVariants([]);
    setEditItemExampleListingUrl("");
    setEditItemMinPriceDollars("");
    setEditError(null);
  }

  function addEditVariantRow() {
    setEditVariants((v) => [
      ...v,
      { label: "", minPriceDollars: "", exampleListingUrl: "", platformProductId: "" },
    ]);
  }

  function removeEditVariantRow(index: number) {
    setEditVariants((v) => v.filter((_, i) => i !== index));
  }

  function updateEditVariant(index: number, patch: Partial<AdminCatalogVariantFormRow>) {
    setEditVariants((v) => v.map((row, i) => (i === index ? { ...row, ...patch } : row)));
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
    const checked = validateCatalogVariantFormRows(editVariants);
    if (!checked.ok) {
      setEditError(checked.error);
      return;
    }
    if (checked.payload.length === 0) {
      const itemLevel = validateItemLevelWhenNoVariants(
        editItemExampleListingUrl,
        editItemMinPriceDollars,
      );
      if (!itemLevel.ok) {
        setEditError(itemLevel.error);
        return;
      }
    }
    const fd = new FormData();
    fd.set("itemId", editingId);
    fd.set("itemName", name);
    fd.set("variantsJson", JSON.stringify(checked.payload));
    fd.set("itemExampleListingUrl", editItemExampleListingUrl);
    fd.set("itemMinPriceDollars", editItemMinPriceDollars);
    startTransition(async () => {
      await adminUpdateCatalogItem(fd);
      cancelEdit();
      router.refresh();
    });
  }

  const flatRows: {
    itemId: string;
    itemName: string;
    variantLabel: string;
    minPriceCents: number;
    exampleUrl: string;
    rowSpan: number;
    variantIndex: number;
    variantId: string | null;
  }[] = [];

  for (const item of items) {
    const variants = item.variants;
    if (variants.length === 0) {
      flatRows.push({
        itemId: item.id,
        itemName: item.name,
        variantLabel: "—",
        minPriceCents: item.itemMinPriceCents,
        exampleUrl: item.itemExampleListingUrl ?? "",
        rowSpan: 1,
        variantIndex: 0,
        variantId: null,
      });
      continue;
    }
    variants.forEach((v, i) => {
      flatRows.push({
        itemId: item.id,
        itemName: item.name,
        variantLabel: v.label,
        minPriceCents: v.minPriceCents,
        exampleUrl: v.exampleListingUrl,
        rowSpan: i === 0 ? variants.length : 0,
        variantIndex: i,
        variantId: v.id,
      });
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
            <AdminCatalogVariantRowsEditor
              variants={editVariants}
              onAddRow={addEditVariantRow}
              onRemoveRow={removeEditVariantRow}
              onChangeRow={updateEditVariant}
            />
            {editVariants.length === 0 ? (
              <AdminCatalogItemLevelFields
                exampleListingUrl={editItemExampleListingUrl}
                minPriceDollars={editItemMinPriceDollars}
                onChangeExampleListingUrl={setEditItemExampleListingUrl}
                onChangeMinPriceDollars={setEditItemMinPriceDollars}
              />
            ) : null}
            {editError ? (
              <p className="text-xs text-amber-200/90" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
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
        <table className="w-full min-w-[36rem] text-left text-xs">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="p-3 font-medium">Item name</th>
              <th className="p-3 font-medium">Variant</th>
              <th className="p-3 font-medium">Example listing</th>
              <th className="p-3 font-medium whitespace-nowrap">Min price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/90 text-zinc-300">
            {flatRows.map((r, idx) => (
              <tr key={`${r.itemId}-${r.variantIndex}-${idx}`} className="align-top">
                {r.rowSpan > 0 ? (
                  <td className="p-3 font-medium text-zinc-200" rowSpan={r.rowSpan}>
                    <div>{r.itemName}</div>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => beginEditItem(r.itemId)}
                        className="text-[11px] text-blue-400/90 hover:underline"
                      >
                        Edit item
                      </button>
                      <form action={adminDeleteCatalogItem}>
                        <input type="hidden" name="itemId" value={r.itemId} />
                        <button
                          type="submit"
                          className="text-[11px] text-blue-400/90 hover:underline"
                          title="Delete this item and all its variants"
                        >
                          Delete item
                        </button>
                      </form>
                    </div>
                  </td>
                ) : null}
                <td className="p-3 text-zinc-400">{r.variantLabel}</td>
                <td className="p-3 text-zinc-400">
                  {r.exampleUrl ? exampleLink(r.exampleUrl) : <span className="text-zinc-600">—</span>}
                </td>
                <AdminMinPriceCell
                  itemId={r.itemId}
                  variantId={r.variantId}
                  variantIndex={r.variantIndex}
                  variantLabel={r.variantLabel}
                  minPriceCents={r.minPriceCents}
                  exampleUrl={r.exampleUrl}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No items yet — use List item above.</p>
      ) : null}
    </>
  );
}
