"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { useFormStatus } from "react-dom";
import type { Prisma } from "@/generated/prisma/client";
import {
  adminClearShopListingSecondaryImage,
  adminFreezeShopListing,
  adminMarkLegacyVariantListingGroupImagesOk,
  adminMarkListingImagesOk,
  adminMarkPrintifyListingReady,
  adminRemoveListingFromRequestsQueue,
  adminUpsertShopListingSecondaryImageForm,
  type AdminSecondaryImageFormState,
} from "@/actions/admin-marketplace";
import { productImageUrlsUnionHero } from "@/lib/product-media";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";
import {
  AdminLegacyVariantListingGroupApproveForm,
  AdminLegacyVariantListingGroupRejectForm,
  AdminListingApproveForm,
  AdminListingRejectForm,
  AdminFreezeSubmitButton,
} from "@/components/admin/AdminListingRequestActionButtons";
import {
  groupLegacyBaselineVariantAdminQueueRows,
  type GroupedDashboardListing,
  type LegacyBaselineListingGroup,
} from "@/lib/dashboard-legacy-baseline-listing-groups";
import type { AdminBaselineRow } from "@/lib/shop-baseline-catalog";

export type ListingRequestTabRow = {
  id: string;
  shopId: string;
  active: boolean;
  adminRemovedFromShopAt: string | null;
  updatedAt: string;
  requestStatus: ListingRequestStatus;
  requestItemName: string | null;
  requestImages: unknown;
  listingPrintifyProductId: string | null;
  listingPrintifyVariantId: string | null;
  /** ISO timestamp from last successful `adminMarkPrintifyListingReady` (save / resave). */
  listingPrintifyCatalogSyncedAt: string | null;
  listingFeePaidAt: string | null;
  listingOrdinal: number;
  /** Admin optional second storefront image (R2 WebP). */
  adminListingSecondaryImageUrl: string | null;
  shop: { displayName: string; slug: string };
  product: {
    id: string;
    name: string;
    slug: string;
    fulfillmentType: FulfillmentType;
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
  };
};

type RequestsTabId = "new" | "fee";

function sortRows(rows: ListingRequestTabRow[]): ListingRequestTabRow[] {
  return [...rows].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function sortGroupedByLatestUpdate(
  groups: GroupedDashboardListing<ListingRequestTabRow>[],
): GroupedDashboardListing<ListingRequestTabRow>[] {
  const latestMs = (g: GroupedDashboardListing<ListingRequestTabRow>) =>
    g.kind === "single"
      ? new Date(g.row.updatedAt).getTime()
      : Math.max(...g.members.map((m) => new Date(m.row.updatedAt).getTime()));
  return [...groups].sort((a, b) => latestMs(b) - latestMs(a));
}

function ListingRequestGroupedCard({
  group,
  printifyCatalogPickList,
  r2Configured,
}: {
  group: LegacyBaselineListingGroup<ListingRequestTabRow>;
  printifyCatalogPickList: PrintifyCatalogPickEntry[];
  r2Configured: boolean;
}) {
  const primary = group.members[0]!.row;
  const imgs = Array.isArray(primary.requestImages) ? (primary.requestImages as string[]) : [];

  const listingIds = useMemo(() => group.members.map((m) => m.row.id), [group.members]);

  const allPrintifyReady = useMemo(
    () =>
      group.members.every((m) => m.row.requestStatus === ListingRequestStatus.printify_item_created),
    [group.members],
  );

  const allHaveHero = useMemo(
    () => group.members.every((m) => productImageUrlsUnionHero(m.row.product).length > 0),
    [group.members],
  );

  const groupApproveDisabled = !allHaveHero;

  const allAwaitingImageReview = useMemo(
    () => group.members.every((m) => m.row.requestStatus === ListingRequestStatus.submitted),
    [group.members],
  );

  return (
    <li
      className={`rounded-lg border p-4 text-sm text-zinc-300 ${
        primary.requestStatus === ListingRequestStatus.approved && primary.active
          ? "border-emerald-900/40 bg-emerald-950/10"
          : "border-zinc-800 bg-zinc-950/20"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-medium">{primary.shop.displayName}</span>
          <span className="font-mono text-xs text-zinc-500">/s/{primary.shop.slug}</span>
          <span className="rounded-full bg-violet-950/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-200/90 ring-1 ring-violet-800/50">
            Multi-size (one request)
          </span>
        </p>
      </div>
      <p className="mt-1 text-xs leading-snug text-zinc-500">
        One listing request with multiple size options (legacy split catalog stubs). Use the same Printify product for
        every option when they belong together. <span className="text-zinc-400">Parent catalog:</span>{" "}
        {group.parentItemName}
      </p>
      {primary.requestItemName?.trim() ? (
        <p className="mt-1 text-xs text-zinc-400">
          Creator name: <span className="font-medium text-zinc-200">{primary.requestItemName.trim()}</span>
        </p>
      ) : null}
      {imgs.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-xs text-zinc-500">
          {imgs.map((u, i) => (
            <li key={i} className="break-all">
              <a
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400/90 underline decoration-blue-500/40 underline-offset-2 hover:text-blue-300"
              >
                {u}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-zinc-600">No image URLs submitted.</p>
      )}

      {allAwaitingImageReview ? (
        <div
          className="mt-4 space-y-3 border-t border-zinc-800 pt-4"
          role="group"
          aria-label="Image check: pass or fail (all sizes)"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Step 1 — Image check</p>
          <p className="text-xs text-zinc-600">
            Do the submitted reference images / URLs pass a print-ready check? This applies to every size in this
            request. Record pass to continue all rows, or fail and reject with a reason.
          </p>
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Passes check</span>
              <form action={adminMarkLegacyVariantListingGroupImagesOk} className="inline-flex">
                <input type="hidden" name="legacyGroupListingIdsJson" value={JSON.stringify(listingIds)} />
                <ImageOkMarkButton />
              </form>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Does not pass</span>
              <AdminLegacyVariantListingGroupRejectForm
                listingIds={listingIds}
                className="max-w-md"
                rejectionReasonLegend="Why it does not pass"
              />
            </div>
          </div>
        </div>
      ) : null}

      {allPrintifyReady ? (
        <div className="mt-4 rounded-lg border border-zinc-800/80 bg-zinc-950/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Decision (all sizes)</p>
          <p className="mt-1 text-xs text-zinc-500">
            Approve or reject applies to every size row in this legacy group together.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] text-zinc-600">Approve</span>
              <AdminLegacyVariantListingGroupApproveForm
                listingIds={listingIds}
                approveDisabled={groupApproveDisabled}
              />
              {groupApproveDisabled ? (
                <span className="text-[10px] text-zinc-600">
                  Approve is disabled until every size has a hero image on its catalog product (sync Printify on each
                  row if needed).
                </span>
              ) : null}
            </div>
            <AdminLegacyVariantListingGroupRejectForm listingIds={listingIds} className="max-w-md" />
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-0">
        {group.members.map(({ row, variantLabel }, idx) => (
          <ListingRequestCard
            key={row.id}
            r={row}
            printifyCatalogPickList={printifyCatalogPickList}
            r2Configured={r2Configured}
            groupedVariant={{ variantLabel, stacked: idx > 0 }}
            suppressLegacyGroupStep3Decision={allPrintifyReady}
            suppressLegacyGroupImageCheck={allAwaitingImageReview}
          />
        ))}
      </div>
    </li>
  );
}

export type PrintifyCatalogPickEntry = {
  id: string;
  title: string;
  /** First enabled variant in live catalog (for default checkout line). */
  defaultVariantId?: string | null;
};

/** Separates title and id in the product picker; parse with {@link tryParseCatalogProductDisplay}. */
const PRINTIFY_PRODUCT_DISPLAY_SEP = " · ";

function tryParseCatalogProductDisplay(
  raw: string,
  knownProductIds: ReadonlySet<string>,
): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (knownProductIds.has(s)) return s;
  const i = s.lastIndexOf(PRINTIFY_PRODUCT_DISPLAY_SEP);
  if (i < 0) return null;
  const idPart = s.slice(i + PRINTIFY_PRODUCT_DISPLAY_SEP.length).trim();
  return idPart && knownProductIds.has(idPart) ? idPart : null;
}

function formatCatalogProductDisplay(title: string, id: string): string {
  return `${title.trim()}${PRINTIFY_PRODUCT_DISPLAY_SEP}${id.trim()}`;
}

/** Shared controlled fields for {@link adminMarkPrintifyListingReady} (step 2 initial save + step 3 resave). */
function AdminPrintifyMappingFormFields({
  r,
  needsPrintifyVariant,
  catalogPickEnabled,
  printifyCatalogPickList,
  printifyProductId,
  setPrintifyProductId,
  printifyProductDisplay,
  onPrintifyProductDisplayChange,
  onPrintifyProductDisplayBlur,
  printifyVariantId,
  setPrintifyVariantId,
}: {
  r: ListingRequestTabRow;
  needsPrintifyVariant: boolean;
  catalogPickEnabled: boolean;
  printifyCatalogPickList: PrintifyCatalogPickEntry[];
  printifyProductId: string;
  setPrintifyProductId: (v: string) => void;
  printifyProductDisplay: string;
  onPrintifyProductDisplayChange: (v: string) => void;
  onPrintifyProductDisplayBlur: () => void;
  printifyVariantId: string;
  setPrintifyVariantId: (v: string) => void;
}) {
  return (
    <>
      <input type="hidden" name="listingId" value={r.id} />
      <label className="block text-xs text-zinc-500">
        Printify product
        {catalogPickEnabled ? (
          <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-zinc-600">
            Pick from the list: <span className="font-medium text-zinc-500">name</span> first, then id (after the
            middle dot). You can paste a raw Printify product id; it normalizes on blur when it matches the catalog.
            Default checkout variant is taken from the catalog for the product you pick.
          </span>
        ) : null}
        {catalogPickEnabled ? (
          <>
            <input type="hidden" name="printifyProductId" value={printifyProductId} />
            <input
              required
              value={printifyProductDisplay}
              onChange={(e) => onPrintifyProductDisplayChange(e.target.value)}
              onBlur={onPrintifyProductDisplayBlur}
              className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
              autoComplete="off"
              aria-invalid={Boolean(printifyProductDisplay.trim()) && !printifyProductId.trim()}
              list={`printify-product-pick-${r.id}`}
            />
            <datalist id={`printify-product-pick-${r.id}`}>
              {printifyCatalogPickList.map((p) => (
                <option
                  key={p.id}
                  value={formatCatalogProductDisplay(p.title.trim() || p.id, p.id.trim())}
                />
              ))}
            </datalist>
          </>
        ) : (
          <input
            name="printifyProductId"
            required
            value={printifyProductId}
            onChange={(e) => setPrintifyProductId(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200"
            autoComplete="off"
          />
        )}
      </label>
      {needsPrintifyVariant && catalogPickEnabled ? (
        <input type="hidden" name="printifyVariantId" value={printifyVariantId} required />
      ) : needsPrintifyVariant ? (
        <details className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-2 text-xs text-zinc-500">
          <summary className="cursor-pointer select-none text-[11px] text-zinc-500 marker:text-zinc-600">
            No live catalog — set default Printify variant ID (required)
          </summary>
          <input
            name="printifyVariantId"
            required
            value={printifyVariantId}
            onChange={(e) => setPrintifyVariantId(e.target.value)}
            className="mt-2 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200"
            autoComplete="off"
            aria-label="Default Printify variant ID for checkout"
          />
        </details>
      ) : !needsPrintifyVariant ? (
        <label className="block text-xs text-zinc-500">
          Variant ID (optional — leave empty for manual fulfillment)
          <input
            name="printifyVariantId"
            value={printifyVariantId}
            onChange={(e) => setPrintifyVariantId(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200"
            autoComplete="off"
          />
        </label>
      ) : null}
    </>
  );
}

function AdminSecondaryImageThumb({
  label,
  src,
  onError,
}: {
  label: string;
  src: string;
  onError?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-600">{label}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-20 w-20 rounded border border-zinc-700 bg-zinc-900 object-cover"
        onError={onError}
      />
    </div>
  );
}

const initialSecondaryImageFormState: AdminSecondaryImageFormState = {
  ok: false,
  error: null,
};

function ListingAdminSecondaryImageUploadForm({
  listingId,
  onFileChange,
  onUrlChange,
  urlDraft,
}: {
  listingId: string;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onUrlChange: (value: string) => void;
  urlDraft: string;
}) {
  const [state, formAction, pending] = useActionState(
    adminUpsertShopListingSecondaryImageForm,
    initialSecondaryImageFormState,
  );

  return (
    <form action={formAction} encType="multipart/form-data" className="mt-2 flex flex-col gap-2 sm:max-w-lg">
      <input type="hidden" name="listingId" value={listingId} />
      <label className="block text-[11px] text-zinc-500">
        Upload (JPEG / PNG / WebP / GIF, max 20 MB before compression)
        <input
          type="file"
          name="adminListingSecondaryImageFile"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onFileChange}
          className="mt-1 block w-full max-w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
        />
      </label>
      <label className="block text-[11px] text-zinc-500">
        Or image URL
        <input
          type="url"
          name="adminListingSecondaryImageUrl"
          placeholder="https://…"
          value={urlDraft}
          onChange={(e) => onUrlChange(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200"
          autoComplete="off"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
      {state.ok ? <p className="text-xs text-emerald-400/95">Uploaded successfully.</p> : null}
      {state.error ? (
        <p className="text-xs text-red-400/95" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function ListingAdminSecondaryImagePanel({
  r,
  r2Configured,
  printifyHeroPreview,
}: {
  r: ListingRequestTabRow;
  r2Configured: boolean;
  printifyHeroPreview: string | null;
}) {
  const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [urlPreviewBroken, setUrlPreviewBroken] = useState(false);

  const revokeBlob = useCallback((u: string | null) => {
    if (u?.startsWith("blob:")) URL.revokeObjectURL(u);
  }, []);

  useEffect(() => {
    return () => revokeBlob(fileObjectUrl);
  }, [fileObjectUrl, revokeBlob]);

  useEffect(() => {
    setFileObjectUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setUrlDraft("");
    setUrlPreviewBroken(false);
  }, [r.id, r.adminListingSecondaryImageUrl]);

  const onFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      setFileObjectUrl((prev) => {
        revokeBlob(prev);
        return f ? URL.createObjectURL(f) : null;
      });
      setUrlPreviewBroken(false);
    },
    [revokeBlob],
  );

  const httpsUrlForPreview = useMemo(() => {
    const t = urlDraft.trim();
    if (!t) return null;
    try {
      const u = new URL(t);
      if (u.protocol !== "https:") return null;
      return t;
    } catch {
      return null;
    }
  }, [urlDraft]);

  useEffect(() => {
    setUrlPreviewBroken(false);
  }, [httpsUrlForPreview]);

  const showUrlThumb = Boolean(httpsUrlForPreview && !fileObjectUrl);
  const hasSecondaryPreviewRow = Boolean(
    r.adminListingSecondaryImageUrl || fileObjectUrl || httpsUrlForPreview,
  );

  return (
    <>
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/25 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Hero (Printify)</p>
        {printifyHeroPreview ? (
          <div className="mt-2 flex flex-wrap items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={printifyHeroPreview}
              alt=""
              className="h-24 w-24 rounded border border-zinc-700 object-cover"
            />
            <p className="max-w-md text-[11px] text-zinc-600">
              Synced from Printify onto the catalog product — buyers see this first. Refresh the admin page if you
              just saved Printify IDs and the preview is stale.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-amber-200/85">
            No hero image on the catalog product yet. Re-save Printify mapping or check Printify mockups before
            approving.
          </p>
        )}
      </div>
      {r2Configured ? (
        <div className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/20 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            Optional second image (admin)
          </p>
          {hasSecondaryPreviewRow ? (
            <div className="flex flex-wrap items-end gap-4">
              {r.adminListingSecondaryImageUrl ? (
                <div className="flex flex-wrap items-end gap-3">
                  <AdminSecondaryImageThumb label="Saved on listing" src={r.adminListingSecondaryImageUrl} />
                  <form action={adminClearShopListingSecondaryImage} className="inline">
                    <input type="hidden" name="listingId" value={r.id} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    >
                      Remove admin second image
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-600">Nothing saved yet — thumbnails update as you pick a file or URL.</p>
              )}
              {fileObjectUrl ? <AdminSecondaryImageThumb label="File preview" src={fileObjectUrl} /> : null}
              {showUrlThumb && httpsUrlForPreview ? (
                urlPreviewBroken ? (
                  <p className="max-w-[11rem] text-[10px] leading-snug text-amber-200/80">
                    URL preview failed (blocked or not an image). You can still try Upload if the server can fetch it.
                  </p>
                ) : (
                  <AdminSecondaryImageThumb
                    label="URL preview"
                    src={httpsUrlForPreview}
                    onError={() => setUrlPreviewBroken(true)}
                  />
                )
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-600">None set — upload a file or paste an HTTPS image URL.</p>
          )}
          <ListingAdminSecondaryImageUploadForm
            key={`${r.id}-${r.adminListingSecondaryImageUrl ? "y" : "n"}`}
            listingId={r.id}
            urlDraft={urlDraft}
            onUrlChange={setUrlDraft}
            onFileChange={onFileChange}
          />
        </div>
      ) : (
        <p className="text-xs text-amber-200/85">
          R2 is not configured — optional admin second image upload is unavailable. Set R2 env vars on the server.
        </p>
      )}
    </>
  );
}

function adminQueueStatusLabel(status: ListingRequestStatus): string {
  if (status === ListingRequestStatus.images_ok) return "Passed check";
  return status;
}

function adminQueueStatusChipClass(status: ListingRequestStatus): string {
  switch (status) {
    case ListingRequestStatus.images_ok:
      return "bg-emerald-950/55 text-emerald-100 ring-2 ring-emerald-500/50 shadow-[0_0_14px_-5px_rgba(52,211,153,0.5)]";
    case ListingRequestStatus.printify_item_created:
      return "bg-violet-950/45 text-violet-100 ring-1 ring-violet-700/50";
    case ListingRequestStatus.submitted:
      return "bg-amber-950/35 text-amber-100/95 ring-1 ring-amber-800/50";
    case ListingRequestStatus.approved:
      return "bg-emerald-950/40 text-emerald-100 ring-1 ring-emerald-800/50";
    case ListingRequestStatus.rejected:
      return "bg-red-950/40 text-red-100 ring-1 ring-red-800/50";
    default:
      return "bg-zinc-900 text-zinc-500 ring-1 ring-zinc-700";
  }
}

const imageOkPillBase =
  "inline-flex items-center justify-center gap-1 rounded-full bg-emerald-950/45 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/95 ring-1 ring-emerald-800/50";
const imageOkPillSubmit = `${imageOkPillBase} cursor-pointer transition hover:bg-emerald-950/60 hover:ring-emerald-700/55 disabled:cursor-not-allowed disabled:opacity-65`;
const imageOkPillSubmitPending = `${imageOkPillBase} cursor-wait opacity-80 ring-emerald-800/40`;
/** Step 2: unselected “Image OK” toggle before affirming Printify save. */
const imageOkNeutralToggle =
  "inline-flex min-h-[2rem] min-w-[7.5rem] items-center justify-center gap-1 rounded-full border border-zinc-600 bg-zinc-950/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 ring-1 ring-zinc-800 transition-all duration-200 ease-out hover:border-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-300";
/** Strong green “on” state so admins see clear feedback (shop stays “In review” via server status after step 1). */
const imageOkAffirmedToggle =
  "inline-flex min-h-[2rem] min-w-[9.5rem] items-center justify-center gap-1 rounded-full bg-emerald-600/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-50 ring-2 ring-emerald-400/90 shadow-[0_0_20px_-6px_rgba(52,211,153,0.75)] cursor-pointer transition-all duration-200 ease-out hover:bg-emerald-500/45 hover:ring-emerald-300";

function ImageOkMarkButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={pending ? imageOkPillSubmitPending : imageOkPillSubmit}
      aria-busy={pending}
      title="Reference images pass the print-ready check"
    >
      {pending ? (
        "Saving…"
      ) : (
        <>
          <span className="text-emerald-400" aria-hidden>
            ✓
          </span>
          Passes check
        </>
      )}
    </button>
  );
}

function formatPrintifyCatalogSyncedAtLabel(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

/** Static hint under step 2 save (submit button is outside this form). */
function PrintifyCatalogSyncHint({ lastSyncedAtIso }: { lastSyncedAtIso: string | null }) {
  const formatted = formatPrintifyCatalogSyncedAtLabel(lastSyncedAtIso);
  return (
    <p className="text-[10px] leading-snug text-zinc-600">
      {formatted && lastSyncedAtIso ? (
        <>
          Last catalog sync{" "}
          <time dateTime={lastSyncedAtIso} className="tabular-nums text-zinc-500">
            {formatted}
          </time>
        </>
      ) : (
        "Catalog sync time is recorded when you save Printify IDs below."
      )}
    </p>
  );
}

/** Submit + pending copy + last sync; must be rendered inside the server-action form. */
function PrintifyCatalogSyncSubmitFooter({ lastSyncedAtIso }: { lastSyncedAtIso: string | null }) {
  const { pending } = useFormStatus();
  const formatted = formatPrintifyCatalogSyncedAtLabel(lastSyncedAtIso);
  return (
    <div className="flex flex-col gap-1.5 border-t border-zinc-800/60 pt-3">
      <button
        type="submit"
        disabled={pending}
        className={
          pending
            ? "w-fit cursor-wait rounded bg-sky-950/50 px-3 py-1.5 text-xs text-sky-200/85 ring-1 ring-sky-800/50"
            : "w-fit rounded bg-sky-900/40 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-900/60 disabled:opacity-60"
        }
        aria-busy={pending}
      >
        {pending ? "Syncing catalog…" : "Resave Printify IDs and sync catalog"}
      </button>
      <p className="text-[10px] leading-snug text-zinc-600" aria-live="polite">
        {pending ? (
          <span className="text-sky-300/90">Pulling mockups and product data from Printify…</span>
        ) : formatted && lastSyncedAtIso ? (
          <>
            Last catalog sync{" "}
            <time dateTime={lastSyncedAtIso} className="tabular-nums text-zinc-500">
              {formatted}
            </time>
          </>
        ) : (
          "No sync recorded yet — submit once to save a timestamp."
        )}
      </p>
    </div>
  );
}

function ListingRequestCard({
  r,
  printifyCatalogPickList,
  r2Configured,
  groupedVariant,
  suppressLegacyGroupStep3Decision = false,
  suppressLegacyGroupImageCheck = false,
}: {
  r: ListingRequestTabRow;
  printifyCatalogPickList: PrintifyCatalogPickEntry[];
  r2Configured: boolean;
  /** When set, this row is rendered inside a multi-variant group (outer &lt;li&gt; is the parent). */
  groupedVariant?: { variantLabel: string; stacked: boolean };
  /** When true with {@link groupedVariant}, hide per-row Step 3 approve/reject (group-level controls apply). */
  suppressLegacyGroupStep3Decision?: boolean;
  /** When true with {@link groupedVariant}, hide per-row Step 1 image check (shown once on the group card). */
  suppressLegacyGroupImageCheck?: boolean;
}) {
  const imgs = Array.isArray(r.requestImages) ? (r.requestImages as string[]) : [];
  const isAwaitingImageReview = r.requestStatus === ListingRequestStatus.submitted;
  const isImagesOkStep = r.requestStatus === ListingRequestStatus.images_ok;
  const isPrintifyReady = r.requestStatus === ListingRequestStatus.printify_item_created;
  const isApproved = r.requestStatus === ListingRequestStatus.approved;
  const adminRemoved = r.adminRemovedFromShopAt != null;
  const needsPrintifyVariant = r.product.fulfillmentType === FulfillmentType.printify;
  const catalogPickEnabled = needsPrintifyVariant && printifyCatalogPickList.length > 0;

  const { variantIdByProductId, titleByProductId, knownProductIds } = useMemo(() => {
    const variantMap = new Map<string, string>();
    const titleMap = new Map<string, string>();
    const ids = new Set<string>();
    for (const p of printifyCatalogPickList) {
      const id = p.id.trim();
      if (!id) continue;
      ids.add(id);
      titleMap.set(id, p.title.trim() || id);
      const dv = p.defaultVariantId?.trim();
      if (dv) variantMap.set(id, dv);
    }
    return {
      variantIdByProductId: variantMap,
      titleByProductId: titleMap,
      knownProductIds: ids,
    };
  }, [printifyCatalogPickList]);

  const [printifyProductId, setPrintifyProductId] = useState(() => r.listingPrintifyProductId ?? "");
  const [printifyProductDisplay, setPrintifyProductDisplay] = useState(() => {
    const id = (r.listingPrintifyProductId ?? "").trim();
    if (!id) return "";
    const row = printifyCatalogPickList.find((p) => p.id.trim() === id);
    return row ? formatCatalogProductDisplay(row.title, id) : id;
  });
  const [printifyVariantId, setPrintifyVariantId] = useState(() => r.listingPrintifyVariantId ?? "");
  /** Step 2 only: admin must click to affirm Image OK before Save Printify is enabled. */
  const [printifyStepImageOk, setPrintifyStepImageOk] = useState(false);

  const printifyHeroPreview = useMemo(
    () => productImageUrlsUnionHero(r.product)[0] ?? null,
    [r.product],
  );

  useEffect(() => {
    setPrintifyStepImageOk(false);
  }, [r.id, r.requestStatus]);

  useEffect(() => {
    const p = (r.listingPrintifyProductId ?? "").trim();
    const vSaved = (r.listingPrintifyVariantId ?? "").trim();
    setPrintifyProductId(p);
    const title = p ? titleByProductId.get(p) : undefined;
    setPrintifyProductDisplay(p ? (title ? formatCatalogProductDisplay(title, p) : p) : "");
    const def = variantIdByProductId.get(p) ?? "";
    setPrintifyVariantId(vSaved || def);
  }, [r.id, r.listingPrintifyProductId, r.listingPrintifyVariantId, variantIdByProductId, titleByProductId]);

  const onPrintifyProductDisplayChange = useCallback(
    (value: string) => {
      setPrintifyProductDisplay(value);
      const resolved = tryParseCatalogProductDisplay(value, knownProductIds);
      if (resolved) {
        setPrintifyProductId(resolved);
        const def = variantIdByProductId.get(resolved);
        if (def) setPrintifyVariantId(def);
      }
    },
    [knownProductIds, variantIdByProductId],
  );

  const onPrintifyProductDisplayBlur = useCallback(() => {
    const resolved =
      tryParseCatalogProductDisplay(printifyProductDisplay, knownProductIds) ??
      (knownProductIds.has(printifyProductDisplay.trim()) ? printifyProductDisplay.trim() : null);
    if (resolved) {
      setPrintifyProductId(resolved);
      const title = titleByProductId.get(resolved);
      setPrintifyProductDisplay(
        title ? formatCatalogProductDisplay(title, resolved) : resolved,
      );
      const def = variantIdByProductId.get(resolved);
      if (def) setPrintifyVariantId(def);
    } else {
      setPrintifyProductId("");
    }
  }, [
    printifyProductDisplay,
    knownProductIds,
    titleByProductId,
    variantIdByProductId,
  ]);
  const statusChip =
    isApproved && r.active
      ? "On shop"
      : isApproved && !r.active && adminRemoved
        ? "Frozen"
        : isApproved && !r.active
          ? "Fee pending"
          : null;

  const shellClass = groupedVariant
    ? groupedVariant.stacked
      ? "mt-4 border-t border-zinc-800 pt-4 text-sm text-zinc-300"
      : "text-sm text-zinc-300"
    : `rounded-lg border p-4 text-sm text-zinc-300 ${
        isApproved ? "border-emerald-900/40 bg-emerald-950/10" : "border-zinc-800 bg-zinc-950/20"
      }`;

  const Shell = groupedVariant ? "div" : "li";

  return (
    <Shell className={shellClass}>
      {!groupedVariant ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="font-medium">{r.shop.displayName}</span>
              <span className="font-mono text-xs text-zinc-500">/s/{r.shop.slug}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${adminQueueStatusChipClass(r.requestStatus)}`}
              >
                {adminQueueStatusLabel(r.requestStatus)}
              </span>
              {statusChip ? (
                <span className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300/90 ring-1 ring-emerald-800/50">
                  {statusChip}
                </span>
              ) : null}
            </p>
            <form action={adminRemoveListingFromRequestsQueue} className="shrink-0">
              <input type="hidden" name="listingId" value={r.id} />
              <button
                type="submit"
                title="Remove from this queue and record under Removed items. Takes live listings off the shop if not already frozen."
                aria-label="Remove from queue"
                className="inline-flex size-7 items-center justify-center rounded border border-zinc-700 bg-zinc-900/80 text-sm leading-none text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
              >
                ×
              </button>
            </form>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Catalog product (one listing — all variants approved or rejected together):{" "}
            <span className="text-zinc-400">{r.product.name}</span> ({r.product.slug}) · {r.product.fulfillmentType}
          </p>
          {r.requestItemName?.trim() ? (
            <p className="mt-1 text-xs text-zinc-400">
              Creator name: <span className="font-medium text-zinc-200">{r.requestItemName.trim()}</span>
            </p>
          ) : null}
          {imgs.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-xs text-zinc-500">
              {imgs.map((u, i) => (
                <li key={i} className="break-all">
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400/90 underline decoration-blue-500/40 underline-offset-2 hover:text-blue-300"
                  >
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-zinc-600">No image URLs submitted.</p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Option: {groupedVariant.variantLabel}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${adminQueueStatusChipClass(r.requestStatus)}`}
              >
                {adminQueueStatusLabel(r.requestStatus)}
              </span>
              {statusChip ? (
                <span className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300/90 ring-1 ring-emerald-800/50">
                  {statusChip}
                </span>
              ) : null}
            </p>
            <form action={adminRemoveListingFromRequestsQueue} className="shrink-0">
              <input type="hidden" name="listingId" value={r.id} />
              <button
                type="submit"
                title="Remove this catalog stub from the queue"
                aria-label="Remove from queue"
                className="inline-flex size-7 items-center justify-center rounded border border-zinc-700 bg-zinc-900/80 text-sm leading-none text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
              >
                ×
              </button>
            </form>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Catalog stub: <span className="text-zinc-400">{r.product.name}</span> ({r.product.slug}) ·{" "}
            {r.product.fulfillmentType}
          </p>
        </>
      )}

      {isAwaitingImageReview && !(suppressLegacyGroupImageCheck && groupedVariant) ? (
        <div
          className="mt-4 space-y-3 border-t border-zinc-800 pt-4"
          role="group"
          aria-label="Image check: pass or fail"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Step 1 — Image check</p>
          <p className="text-xs text-zinc-600">
            Do the submitted reference images / URLs pass a print-ready check? Record pass to continue, or fail and
            reject with a reason.
          </p>
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Passes check</span>
              <form action={adminMarkListingImagesOk} className="inline-flex">
                <input type="hidden" name="listingId" value={r.id} />
                <ImageOkMarkButton />
              </form>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Does not pass</span>
              <AdminListingRejectForm
                listingId={r.id}
                className="max-w-md"
                rejectionReasonLegend="Why it does not pass"
              />
            </div>
          </div>
        </div>
      ) : null}

      {(isImagesOkStep || isPrintifyReady) ? (
        <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
      {isImagesOkStep ? (
        <>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Step 1 - Image Check</p>
          <div
            className="flex flex-wrap items-start gap-8"
            role="group"
            aria-label="Step 1 image check: Image OK or image rejected"
          >
            <div className="flex min-w-0 max-w-xs flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Image OK</span>
              <button
                type="button"
                onClick={() => setPrintifyStepImageOk((v) => !v)}
                aria-pressed={printifyStepImageOk}
                aria-describedby={`image-ok-step2-hint-${r.id}`}
                className={printifyStepImageOk ? imageOkAffirmedToggle : imageOkNeutralToggle}
                title={
                  printifyStepImageOk
                    ? "Click to clear passed check for this step (re-enable reject)"
                    : "Click when reference images are acceptable — required before saving Printify IDs"
                }
              >
                {printifyStepImageOk ? (
                  <>
                    <span className="text-emerald-200 drop-shadow-sm" aria-hidden>
                      ✓
                    </span>
                    Passed check
                  </>
                ) : (
                  "Image OK"
                )}
              </button>
              <span id={`image-ok-live-${r.id}`} className="sr-only" aria-live="polite" aria-atomic="true">
                {printifyStepImageOk
                  ? "Passed check. Reject is disabled. You can save Printify IDs."
                  : "Image OK not selected. Choose Image OK or reject."}
              </span>
              <p
                id={`image-ok-step2-hint-${r.id}`}
                className={`text-[11px] leading-snug transition-colors duration-200 ${printifyStepImageOk ? "text-emerald-200/90" : "text-zinc-600"}`}
              >
                {printifyStepImageOk ? (
                  <>
                    <span className="font-medium text-emerald-300/95">Confirmed for this step.</span> Enter Printify
                    product / variant IDs below and save — then step 3 (admin images, then approve or reject). The shop
                    still shows{" "}
                    <span className="font-medium text-zinc-400">In review</span> until you approve.
                  </>
                ) : (
                  <>
                    Click <span className="font-medium text-zinc-500">Image OK</span> for clear green confirmation,
                    then fill Printify IDs and save.
                  </>
                )}
              </p>
            </div>
            <div
              className={`flex min-w-0 flex-1 flex-col gap-1.5 transition-opacity duration-200 ${printifyStepImageOk ? "opacity-40 saturate-50" : ""}`}
              aria-disabled={printifyStepImageOk}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Image rejected</span>
              <AdminListingRejectForm
                listingId={r.id}
                className="max-w-md"
                rejectionReasonLegend="Why images are rejected"
                disabled={printifyStepImageOk}
              />
            </div>
          </div>
          <form
          id={`admin-printify-save-${r.id}`}
          action={adminMarkPrintifyListingReady}
          className="space-y-3"
          onSubmit={(e) => {
            if (!printifyStepImageOk) {
              e.preventDefault();
              return;
            }
            if (
              needsPrintifyVariant &&
              (!printifyProductId.trim() || !printifyVariantId.trim())
            ) {
              e.preventDefault();
            }
          }}
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Step 2 - Printify Item Mapping
          </p>
          <AdminPrintifyMappingFormFields
            r={r}
            needsPrintifyVariant={needsPrintifyVariant}
            catalogPickEnabled={catalogPickEnabled}
            printifyCatalogPickList={printifyCatalogPickList}
            printifyProductId={printifyProductId}
            setPrintifyProductId={setPrintifyProductId}
            printifyProductDisplay={printifyProductDisplay}
            onPrintifyProductDisplayChange={onPrintifyProductDisplayChange}
            onPrintifyProductDisplayBlur={onPrintifyProductDisplayBlur}
            printifyVariantId={printifyVariantId}
            setPrintifyVariantId={setPrintifyVariantId}
          />
          </form>
          <div className="border-t border-zinc-800/80 pt-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                Save Printify mapping (then Step 3 — admin images &amp; approve)
              </span>
              <button
                type="submit"
                form={`admin-printify-save-${r.id}`}
                disabled={!printifyStepImageOk}
                title={
                  printifyStepImageOk
                    ? undefined
                    : "Click Image OK above before saving Printify IDs"
                }
                className="w-fit rounded bg-sky-900/40 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-900/60 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Save Printify IDs &amp; mark “Printify item created”
              </button>
            </div>
            <PrintifyCatalogSyncHint lastSyncedAtIso={r.listingPrintifyCatalogSyncedAt} />
          </div>
          <p className="text-[11px] leading-snug text-zinc-600">
            After save, <span className="font-medium text-zinc-500">Step 3 — Admin images</span> (optional
            second image) and <span className="font-medium text-zinc-500">Approve</span> /{" "}
            <span className="font-medium text-zinc-500">Reject</span> appear below.
          </p>
        </>
      ) : null}

      {isPrintifyReady ? (
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Step 3 — Admin images
          </p>
          <p className="text-xs text-zinc-500">
            Listing images are compressed to about <span className="font-medium text-zinc-400">100 KiB</span>{" "}
            on save. The <span className="font-medium text-zinc-400">hero</span> comes from the Printify item
            (synced to the catalog product). You may add one <span className="font-medium text-zinc-400">optional</span>{" "}
            second image (upload or HTTPS URL); it appears on the shop after approval. The shop owner cannot remove
            hero or admin images — only their own optional extra photo on the dashboard.
          </p>
          <p className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-400">Saved mapping</span> — Printify product:{" "}
            <span className="font-mono text-zinc-400">{r.listingPrintifyProductId ?? "—"}</span>
            {needsPrintifyVariant ? (
              <>
                {" "}
                · default variant (checkout):{" "}
                <span className="font-mono text-zinc-400">{r.listingPrintifyVariantId ?? "—"}</span>
              </>
            ) : null}
          </p>
          <details className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-2">
            <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-400">
              Edit and resave Printify IDs (re-syncs catalog mockups)
            </summary>
            <div className="mt-3 space-y-3">
              <form
                id={`admin-printify-resave-${r.id}`}
                action={adminMarkPrintifyListingReady}
                className="space-y-3"
                onSubmit={(e) => {
                  if (
                    needsPrintifyVariant &&
                    (!printifyProductId.trim() || !printifyVariantId.trim())
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <AdminPrintifyMappingFormFields
                  r={r}
                  needsPrintifyVariant={needsPrintifyVariant}
                  catalogPickEnabled={catalogPickEnabled}
                  printifyCatalogPickList={printifyCatalogPickList}
                  printifyProductId={printifyProductId}
                  setPrintifyProductId={setPrintifyProductId}
                  printifyProductDisplay={printifyProductDisplay}
                  onPrintifyProductDisplayChange={onPrintifyProductDisplayChange}
                  onPrintifyProductDisplayBlur={onPrintifyProductDisplayBlur}
                  printifyVariantId={printifyVariantId}
                  setPrintifyVariantId={setPrintifyVariantId}
                />
                <PrintifyCatalogSyncSubmitFooter lastSyncedAtIso={r.listingPrintifyCatalogSyncedAt} />
              </form>
            </div>
          </details>
          <ListingAdminSecondaryImagePanel
            r={r}
            r2Configured={r2Configured}
            printifyHeroPreview={printifyHeroPreview}
          />
          {suppressLegacyGroupStep3Decision && groupedVariant ? (
            <p className="text-[11px] text-zinc-600">
              Use <span className="font-medium text-zinc-400">Approve all sizes</span> /{" "}
              <span className="font-medium text-zinc-400">Reject all sizes</span> in the{" "}
              <span className="font-medium text-zinc-400">Decision (all sizes)</span> box above the size list.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-zinc-600">
                One listing for the whole catalog product — all variants are approved or rejected together.
              </p>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Decision</span>
                <div className="flex flex-wrap items-end gap-6">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[10px] text-zinc-600">Approve item</span>
                    <AdminListingApproveForm
                      listingId={r.id}
                      productId={r.product.id}
                      approveButtonLabel="Approve item"
                      approvePendingLabel="Approving item…"
                      approveButtonClassName="px-4 py-2 text-sm font-medium"
                      approveDisabled={!printifyHeroPreview}
                    />
                    {!printifyHeroPreview ? (
                      <span className="text-[10px] text-zinc-600">
                        Approve disabled until the product has a hero image.
                      </span>
                    ) : null}
                  </div>
                  <AdminListingRejectForm listingId={r.id} className="max-w-md" />
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
        </div>
      ) : null}

      {isApproved ? (
        <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Admin listing images</p>
          <p className="text-xs text-zinc-500">
            Hero and optional second image (same as step 3). You can update the second image while this listing awaits
            the publication fee.
          </p>
          <p className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-400">Printify mapping</span> — product:{" "}
            <span className="font-mono text-zinc-400">{r.listingPrintifyProductId ?? "—"}</span>
            {needsPrintifyVariant ? (
              <>
                {" "}
                · variant: <span className="font-mono text-zinc-400">{r.listingPrintifyVariantId ?? "—"}</span>
              </>
            ) : null}
          </p>
          <details className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-2">
            <summary className="cursor-pointer select-none text-[11px] font-medium text-zinc-400">
              Resave Printify IDs (re-syncs catalog before go-live)
            </summary>
            <div className="mt-3 space-y-3">
              <form
                id={`admin-printify-resave-approved-${r.id}`}
                action={adminMarkPrintifyListingReady}
                className="space-y-3"
                onSubmit={(e) => {
                  if (
                    needsPrintifyVariant &&
                    (!printifyProductId.trim() || !printifyVariantId.trim())
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <AdminPrintifyMappingFormFields
                  r={r}
                  needsPrintifyVariant={needsPrintifyVariant}
                  catalogPickEnabled={catalogPickEnabled}
                  printifyCatalogPickList={printifyCatalogPickList}
                  printifyProductId={printifyProductId}
                  setPrintifyProductId={setPrintifyProductId}
                  printifyProductDisplay={printifyProductDisplay}
                  onPrintifyProductDisplayChange={onPrintifyProductDisplayChange}
                  onPrintifyProductDisplayBlur={onPrintifyProductDisplayBlur}
                  printifyVariantId={printifyVariantId}
                  setPrintifyVariantId={setPrintifyVariantId}
                />
                <PrintifyCatalogSyncSubmitFooter lastSyncedAtIso={r.listingPrintifyCatalogSyncedAt} />
              </form>
            </div>
          </details>
          <ListingAdminSecondaryImagePanel
            r={r}
            r2Configured={r2Configured}
            printifyHeroPreview={printifyHeroPreview}
          />
        </div>
      ) : null}

      {isApproved ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-800/80 pt-4">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-200 ring-1 ring-emerald-800/50"
            role="status"
          >
            <span className="text-emerald-400" aria-hidden>
              ✓
            </span>
            Approved
          </span>
          {r.active ? (
            <form action={adminFreezeShopListing} className="inline-flex flex-wrap items-center gap-2">
              <input type="hidden" name="listingId" value={r.id} />
              <AdminFreezeSubmitButton />
              <span className="text-[11px] text-zinc-600">Hides this listing from the creator&apos;s shop.</span>
            </form>
          ) : adminRemoved ? (
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">Frozen</span> — not shown on the shop.
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">Awaiting publication fee</span> — listing{" "}
              <span className="tabular-nums text-zinc-400">#{r.listingOrdinal}</span> requires payment before it can go
              live. After the creator pays (or free-slot waiver applies), this row leaves Listing requests and you can
              follow it under <span className="text-zinc-400">Shop watch</span>.
            </p>
          )}
        </div>
      ) : null}
    </Shell>
  );
}

export function AdminListingRequestsTab(props: {
  rows: ListingRequestTabRow[];
  /** Baseline catalog rows — used to merge legacy per-variant stubs into one queue card. */
  adminCatalogItems: AdminBaselineRow[];
  /** Printify API catalog for product-ID autocomplete + default variant IDs. */
  printifyCatalogPickList?: PrintifyCatalogPickEntry[];
  /** When false, hide admin secondary image upload (R2 env missing). */
  r2Configured?: boolean;
}) {
  const { rows, adminCatalogItems, printifyCatalogPickList = [], r2Configured = true } = props;
  const [tab, setTab] = useState<RequestsTabId>("new");

  const newRows = useMemo(
    () =>
      sortRows(
        rows.filter(
          (r) =>
            r.requestStatus === ListingRequestStatus.submitted ||
            r.requestStatus === ListingRequestStatus.images_ok ||
            r.requestStatus === ListingRequestStatus.printify_item_created,
        ),
      ),
    [rows],
  );

  const feeRows = useMemo(
    () => sortRows(rows.filter((r) => r.requestStatus === ListingRequestStatus.approved)),
    [rows],
  );

  const groupedNewRows = useMemo(
    () =>
      sortGroupedByLatestUpdate(
        adminCatalogItems.length > 0
          ? groupLegacyBaselineVariantAdminQueueRows(newRows, adminCatalogItems)
          : newRows.map((row) => ({ kind: "single" as const, row })),
      ),
    [newRows, adminCatalogItems],
  );

  const groupedFeeRows = useMemo(
    () =>
      sortGroupedByLatestUpdate(
        adminCatalogItems.length > 0
          ? groupLegacyBaselineVariantAdminQueueRows(feeRows, adminCatalogItems)
          : feeRows.map((row) => ({ kind: "single" as const, row })),
      ),
    [feeRows, adminCatalogItems],
  );

  const setTabNew = useCallback(() => setTab("new"), []);
  const setTabFee = useCallback(() => setTab("fee"), []);

  const visibleGrouped = tab === "new" ? groupedNewRows : groupedFeeRows;

  return (
    <section aria-label="Listing requests">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Listing requests</h2>
      <p className="mt-1 text-xs text-zinc-600">
        <strong className="font-medium text-zinc-500">New requests</strong>: submitted — image check (pass or fail /
        reject); then Step 1 — Image Check + Step 2 — Printify Item Mapping (or reject); Step 3 — admin listing images
        (optional second image) then approve or reject (one listing per catalog product; all variants together).{" "}
        <strong className="font-medium text-zinc-500">Awaiting fee</strong>: approved listings that still need a paid
        publication fee (not in the free slots). Once the fee is recorded or the slot is free, the row leaves this tab
        — use <strong className="font-medium text-zinc-500">Shop watch</strong> for live / frozen / removed listings.
      </p>

      <div
        className="mt-4 flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3"
        role="tablist"
        aria-label="Listing requests views"
      >
        <button
          type="button"
          role="tab"
          id="listing-requests-tab-new"
          aria-selected={tab === "new"}
          aria-controls="listing-requests-panel-new"
          onClick={setTabNew}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            tab === "new"
              ? "border-zinc-500 bg-zinc-800/80 text-zinc-100"
              : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          }`}
        >
          New requests
          <span className="ml-1.5 tabular-nums text-zinc-500">({groupedNewRows.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          id="listing-requests-tab-fee"
          aria-selected={tab === "fee"}
          aria-controls="listing-requests-panel-fee"
          onClick={setTabFee}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            tab === "fee"
              ? "border-zinc-500 bg-zinc-800/80 text-zinc-100"
              : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          }`}
        >
          Awaiting listing fee
          <span className="ml-1.5 tabular-nums text-zinc-500">({groupedFeeRows.length})</span>
        </button>
      </div>

      <div
        role="tabpanel"
        id={tab === "new" ? "listing-requests-panel-new" : "listing-requests-panel-fee"}
        aria-labelledby={tab === "new" ? "listing-requests-tab-new" : "listing-requests-tab-fee"}
        className="mt-4"
      >
        {visibleGrouped.length > 0 ? (
          <ul className="space-y-4">
            {visibleGrouped.map((g) =>
              g.kind === "single" ? (
                <ListingRequestCard
                  key={g.row.id}
                  r={g.row}
                  printifyCatalogPickList={printifyCatalogPickList}
                  r2Configured={r2Configured}
                />
              ) : (
                <ListingRequestGroupedCard
                  key={g.members.map((m) => m.row.id).join("-")}
                  group={g}
                  printifyCatalogPickList={printifyCatalogPickList}
                  r2Configured={r2Configured}
                />
              ),
            )}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600">
            {tab === "new"
              ? "No new requests awaiting Printify setup or approval."
              : "No approved listings waiting on a publication fee."}
          </p>
        )}
      </div>
    </section>
  );
}
