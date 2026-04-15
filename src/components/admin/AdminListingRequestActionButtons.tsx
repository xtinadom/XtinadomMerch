"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import {
  adminApproveLegacyVariantListingGroup,
  adminApproveListingRequest,
  adminRejectLegacyVariantListingGroup,
  adminRejectListingRequest,
} from "@/actions/admin-marketplace";
import { LISTING_REJECT_REASON_VALUES } from "@/lib/listing-request-reject-reasons";

const approveIdle =
  "rounded bg-emerald-900/40 px-3 py-1 text-xs text-emerald-200 transition hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-60";
const approvePending =
  "cursor-wait rounded bg-emerald-900/30 px-3 py-1 text-xs text-emerald-200/90 ring-1 ring-emerald-800/40 disabled:opacity-90";

const rejectIdle =
  "rounded border border-red-900/50 bg-red-950/20 px-3 py-1 text-xs font-medium text-red-200/90 hover:border-red-800/70 hover:bg-red-950/35 disabled:cursor-not-allowed disabled:opacity-60";
const rejectPending =
  "cursor-wait rounded border border-red-900/40 bg-red-950/15 px-3 py-1 text-xs font-medium text-red-200/80 ring-1 ring-red-900/30";

function AdminApproveSubmitButton({
  label = "Approve",
  pendingLabel = "Approving…",
  buttonClassName,
  disabled: disabledProp = false,
}: {
  label?: string;
  pendingLabel?: string;
  /** Merges with default approve button styles (listing-request flow uses a larger primary). */
  buttonClassName?: string;
  /** When true, submit is blocked (e.g. Printify hero not synced yet). */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const base = pending ? approvePending : approveIdle;
  const className = buttonClassName ? `${base} ${buttonClassName}` : base;
  const disabled = pending || disabledProp;
  return (
    <button type="submit" disabled={disabled} className={className} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

const rejectReasonFieldId = "admin-listing-reject-reason";

function AdminListingRejectReasonRadios({
  legendText,
  disabled = false,
}: {
  legendText: string;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-1.5 border-0 p-0 transition-opacity duration-200">
      <legend id={rejectReasonFieldId} className="text-[11px] font-medium text-zinc-500">
        {legendText}
      </legend>
      <div className="mt-1 space-y-1.5" role="group" aria-labelledby={rejectReasonFieldId}>
        {LISTING_REJECT_REASON_VALUES.map((value, index) => (
          <label
            key={value}
            className={`flex items-start gap-2 text-xs ${disabled ? "cursor-not-allowed text-zinc-500" : "cursor-pointer text-zinc-300"}`}
          >
            <input
              type="radio"
              name="rejectReason"
              value={value}
              required={index === 0 && !disabled}
              disabled={disabled}
              className="mt-0.5 shrink-0"
            />
            <span>
              {value === "regulations" ? (
                <>
                  Goes against{" "}
                  <Link
                    href="/shop-regulations"
                    className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    item regulations
                  </Link>
                </>
              ) : value === "artwork" ? (
                "Artwork or file doesn't meet print-ready requirements"
              ) : (
                "Other"
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Uses `form action={serverAction}` so the request runs as a proper Server Action POST (manual `await action(fd)` from `onSubmit` is unreliable). */
export function AdminListingApproveForm({
  listingId,
  productId,
  approveButtonLabel = "Approve",
  approvePendingLabel = "Approving…",
  approveButtonClassName,
  approveDisabled = false,
}: {
  listingId: string;
  productId: string;
  approveButtonLabel?: string;
  approvePendingLabel?: string;
  approveButtonClassName?: string;
  approveDisabled?: boolean;
}) {
  return (
    <form action={adminApproveListingRequest} className="inline-flex flex-wrap items-end gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="productId" value={productId} />
      <AdminApproveSubmitButton
        label={approveButtonLabel}
        pendingLabel={approvePendingLabel}
        buttonClassName={approveButtonClassName}
        disabled={approveDisabled}
      />
    </form>
  );
}

export function AdminListingRejectForm({
  listingId,
  className,
  rejectionReasonLegend = "Rejection reason",
  disabled = false,
  rejectButtonLabel = "Reject",
  rejectPendingLabel = "Rejecting…",
}: {
  listingId: string;
  className?: string;
  /** Fieldset legend above radio reasons (e.g. image-check step uses clearer copy). */
  rejectionReasonLegend?: string;
  /** When true, radios and reject are inactive (e.g. Image OK path selected). */
  disabled?: boolean;
  rejectButtonLabel?: string;
  rejectPendingLabel?: string;
}) {
  return (
    <form
      action={adminRejectListingRequest}
      className={[
        className,
        "inline-flex min-w-0 max-w-md flex-col gap-2",
        disabled ? "pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onSubmit={(e) => {
        if (disabled) e.preventDefault();
      }}
    >
      <input type="hidden" name="listingId" value={listingId} />
      <AdminListingRejectReasonRadios legendText={rejectionReasonLegend} disabled={disabled} />
      <div>
        <AdminRejectSubmitButton
          formDisabled={disabled}
          label={rejectButtonLabel}
          pendingLabel={rejectPendingLabel}
        />
      </div>
    </form>
  );
}

function AdminRejectSubmitButton({
  formDisabled = false,
  label = "Reject",
  pendingLabel = "Rejecting…",
}: {
  formDisabled?: boolean;
  label?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const disabled = pending || formDisabled;
  return (
    <button
      type="submit"
      disabled={disabled}
      className={pending ? rejectPending : rejectIdle}
      aria-busy={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AdminLegacyVariantListingGroupApproveForm({
  listingIds,
  approveDisabled = false,
}: {
  listingIds: string[];
  approveDisabled?: boolean;
}) {
  return (
    <form action={adminApproveLegacyVariantListingGroup} className="inline-flex flex-wrap items-end gap-2">
      <input type="hidden" name="legacyGroupListingIdsJson" value={JSON.stringify(listingIds)} />
      <AdminApproveSubmitButton
        label="Approve all sizes"
        pendingLabel="Approving all sizes…"
        buttonClassName="px-4 py-2 text-sm font-medium"
        disabled={approveDisabled}
      />
    </form>
  );
}

export function AdminLegacyVariantListingGroupRejectForm({
  listingIds,
  className,
  rejectionReasonLegend = "Rejection reason (applies to every size)",
}: {
  listingIds: string[];
  className?: string;
  rejectionReasonLegend?: string;
}) {
  return (
    <form
      action={adminRejectLegacyVariantListingGroup}
      className={[className, "inline-flex min-w-0 max-w-md flex-col gap-2"].filter(Boolean).join(" ")}
    >
      <input type="hidden" name="legacyGroupListingIdsJson" value={JSON.stringify(listingIds)} />
      <AdminListingRejectReasonRadios legendText={rejectionReasonLegend} />
      <div>
        <AdminRejectSubmitButton label="Reject all sizes" pendingLabel="Rejecting all sizes…" />
      </div>
    </form>
  );
}

export function AdminFreezeSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded border border-amber-900/50 bg-amber-950/30 px-3 py-1 text-xs text-amber-200/90 transition hover:border-amber-700/50 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? "Freezing…" : "Freeze"}
    </button>
  );
}
