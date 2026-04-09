"use client";

import {
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
  type FormEvent,
  type ReactNode,
} from "react";
import { ListingFormRecalcContext } from "@/components/admin/listing-form-recalc-context";

function serializeForm(form: HTMLFormElement): string {
  const parts: string[] = [];
  const elements = form.querySelectorAll("input, textarea, select");
  elements.forEach((el) => {
    const e = el as HTMLInputElement;
    if (!e.name || e.type === "submit" || e.type === "button") return;
    if (e.type === "checkbox" || e.type === "radio") {
      parts.push(`${e.name}:${e.checked ? "1" : "0"}`);
    } else {
      parts.push(`${e.name}:${e.value}`);
    }
  });
  return parts.join("\u001f");
}

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  /** After redirect from server — show “Saved” on the disabled button until the user edits. */
  savedHighlight?: boolean;
};

export function SaveListingForm({ action, children, savedHighlight }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const initialSnapshot = useRef<string>("");
  const snapshotReady = useRef(false);
  const [dirty, setDirty] = useState(false);

  const recalc = useCallback(() => {
    if (!formRef.current || !snapshotReady.current) return;
    const now = serializeForm(formRef.current);
    setDirty(now !== initialSnapshot.current);
  }, []);

  useLayoutEffect(() => {
    snapshotReady.current = false;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        if (!formRef.current) return;
        initialSnapshot.current = serializeForm(formRef.current);
        snapshotReady.current = true;
        setDirty(false);
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [savedHighlight]);

  const onFormChange = useCallback(
    (_e: FormEvent<HTMLFormElement>) => {
      recalc();
    },
    [recalc],
  );

  const justSaved = Boolean(savedHighlight && !dirty);
  const canSubmit = dirty;

  return (
    <form
      ref={formRef}
      action={action}
      onChange={onFormChange}
      onInput={onFormChange}
      className="space-y-3"
    >
      <ListingFormRecalcContext.Provider value={recalc}>
        {children}
      </ListingFormRecalcContext.Provider>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          title={
            dirty ? "Save changes to this listing" : "Listing is up to date"
          }
          className={
            dirty
              ? "rounded bg-blue-900/80 px-3 py-2 text-xs font-medium text-blue-100 hover:bg-blue-800/80"
              : justSaved
                ? "cursor-default rounded border border-emerald-900/40 bg-zinc-900/50 px-3 py-2 text-xs font-medium text-emerald-300/90"
                : "cursor-default rounded border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-xs font-medium text-zinc-400"
          }
        >
          {dirty ? "Save listing" : "Saved"}
        </button>
      </div>
    </form>
  );
}
