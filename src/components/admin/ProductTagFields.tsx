"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Tag } from "@/generated/prisma/client";
import { adminEnsureTagByName } from "@/actions/admin-tags";
import { useListingFormRecalc } from "@/components/admin/listing-form-recalc-context";

export type AdminTagRow = Pick<Tag, "id" | "slug" | "name" | "sortOrder">;

type Props = {
  tags: AdminTagRow[];
  defaultTagIds: string[];
};

function mergeTagCatalog(
  fromServer: AdminTagRow[],
  extra: AdminTagRow[],
): AdminTagRow[] {
  const map = new Map<string, AdminTagRow>();
  for (const t of fromServer) map.set(t.id, t);
  for (const t of extra) map.set(t.id, t);
  return [...map.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

export function ProductTagFields({ tags: allTags, defaultTagIds }: Props) {
  const recalcListing = useListingFormRecalc();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tagCatalog, setTagCatalog] = useState<AdminTagRow[]>(() =>
    mergeTagCatalog(allTags, []),
  );

  const [selected, setSelected] = useState<string[]>(() => {
    const allowed = new Set(allTags.map((t) => t.id));
    return defaultTagIds.filter((id) => allowed.has(id));
  });

  const [input, setInput] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  useEffect(() => {
    setTagCatalog((prev) => mergeTagCatalog(allTags, prev));
  }, [allTags]);

  useEffect(() => {
    const ids = new Set(tagCatalog.map((t) => t.id));
    setSelected((prev) => prev.filter((id) => ids.has(id)));
  }, [tagCatalog]);

  const byId = useMemo(() => new Map(tagCatalog.map((t) => [t.id, t])), [tagCatalog]);

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    const pool = tagCatalog.filter((t) => !selected.includes(t.id));
    if (!q) return pool.slice(0, 12);
    return pool
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [input, tagCatalog, selected]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [input, suggestions.length]);

  const addById = useCallback((id: string) => {
    setError(null);
    setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setInput("");
    setSuggestionsOpen(false);
    inputRef.current?.focus();
  }, []);

  const addFromInput = useCallback(async () => {
    const raw = input.trim();
    if (!raw || pending) return;

    const lower = raw.toLowerCase();
    const exact = tagCatalog.find(
      (t) =>
        !selected.includes(t.id) &&
        (t.name.toLowerCase() === lower || t.slug.toLowerCase() === lower),
    );
    if (exact) {
      addById(exact.id);
      return;
    }

    if (suggestions.length > 0) {
      const pick = suggestions[Math.min(highlightIdx, suggestions.length - 1)]!;
      addById(pick.id);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const r = await adminEnsureTagByName(raw);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setTagCatalog((c) => mergeTagCatalog(c, [r.tag]));
      setSelected((prev) =>
        prev.includes(r.tag.id) ? prev : [...prev, r.tag.id],
      );
      setInput("");
      setSuggestionsOpen(false);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }, [addById, highlightIdx, input, pending, selected, suggestions, tagCatalog]);

  const remove = useCallback((id: string) => {
    setSelected((prev) => prev.filter((x) => x !== id));
  }, []);

  useLayoutEffect(() => {
    recalcListing?.();
  }, [selected, recalcListing]);

  function clearBlurTimer() {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  }

  const showList = suggestionsOpen && suggestions.length > 0;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-500">Tags</p>
      <p className="text-[11px] text-zinc-600">
        Type to search or add a tag. <kbd className="rounded border border-zinc-700 px-0.5">Enter</kbd> uses the
        highlighted suggestion, or creates a new tag if none match. First tag is the primary label on product cards.
        With none selected, the listing is saved as <strong className="font-medium text-zinc-500">No tag</strong>.
      </p>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((id, index) => {
            const t = byId.get(id);
            const label = t?.name ?? id;
            return (
              <li
                key={id}
                className="inline-flex max-w-full items-center gap-1 rounded-lg border border-zinc-600 bg-zinc-900/80 pl-2.5 text-sm text-zinc-200"
              >
                {index === 0 ? (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-500/90">
                    Primary
                  </span>
                ) : null}
                <span className="min-w-0 truncate">{label}</span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="shrink-0 border-l border-zinc-700/80 px-2 py-1 text-zinc-500 hover:text-red-300"
                  aria-label={`Remove ${label}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="relative max-w-xl">
        <input
          ref={inputRef}
          type="text"
          value={input}
          disabled={pending}
          autoComplete="off"
          placeholder="Search or add a tag…"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
            setSuggestionsOpen(true);
          }}
          onFocus={() => {
            clearBlurTimer();
            setSuggestionsOpen(true);
          }}
          onBlur={() => {
            blurCloseTimer.current = setTimeout(() => setSuggestionsOpen(false), 180);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              if (suggestions.length === 0) return;
              e.preventDefault();
              setHighlightIdx((i) => Math.min(suggestions.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              if (suggestions.length === 0) return;
              e.preventDefault();
              setHighlightIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              void addFromInput();
            } else if (e.key === "Backspace" && input === "" && selected.length > 0) {
              remove(selected[selected.length - 1]!);
            } else if (e.key === "Escape") {
              setSuggestionsOpen(false);
            }
          }}
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 disabled:opacity-60"
        />
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg"
          >
            {suggestions.map((t, i) => (
              <li key={t.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlightIdx}
                  className={
                    i === highlightIdx
                      ? "w-full bg-zinc-800 px-3 py-2 text-left text-sm text-zinc-100"
                      : "w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/60"
                  }
                  onMouseEnter={() => setHighlightIdx(i)}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => addById(t.id)}
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-400/90">{error}</p> : null}
      {pending ? <p className="text-[11px] text-zinc-500">Saving tag…</p> : null}

      <div className="hidden" aria-hidden>
        {selected.map((id) => (
          <input key={id} type="hidden" name="tagIds" value={id} />
        ))}
      </div>
    </div>
  );
}
