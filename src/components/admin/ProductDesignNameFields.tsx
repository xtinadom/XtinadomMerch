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
import {
  MAX_DESIGN_NAME_LEN,
  MAX_DESIGN_NAMES_PER_PRODUCT,
} from "@/lib/product-design-name-form";
import { useListingFormRecalc } from "@/components/admin/listing-form-recalc-context";

type Props = {
  /** Distinct names from other products (typeahead pool). */
  knownNames: string[];
  defaultNames: string[];
};

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

export function ProductDesignNameFields({ knownNames, defaultNames }: Props) {
  const recalcListing = useListingFormRecalc();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selected, setSelected] = useState<string[]>(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of defaultNames) {
      const t = n.trim().slice(0, MAX_DESIGN_NAME_LEN);
      if (!t) continue;
      const k = normKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= MAX_DESIGN_NAMES_PER_PRODUCT) break;
    }
    return out;
  });

  const [input, setInput] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const suggestions = useMemo(() => {
    const selectedKeys = new Set(selected.map(normKey));
    const q = input.trim().toLowerCase();
    const pool = knownNames.filter((n) => !selectedKeys.has(normKey(n)));
    if (!q) return pool.slice(0, 12);
    return pool
      .filter((n) => n.toLowerCase().includes(q))
      .slice(0, 12);
  }, [input, knownNames, selected]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [input, suggestions.length]);

  const addName = useCallback((name: string) => {
    const t = name.trim().slice(0, MAX_DESIGN_NAME_LEN);
    if (!t) return;
    const k = normKey(t);
    setSelected((prev) => {
      if (prev.some((x) => normKey(x) === k)) return prev;
      if (prev.length >= MAX_DESIGN_NAMES_PER_PRODUCT) return prev;
      return [...prev, t];
    });
    setInput("");
    setSuggestionsOpen(false);
    inputRef.current?.focus();
  }, []);

  const addFromInput = useCallback(() => {
    const raw = input.trim().slice(0, MAX_DESIGN_NAME_LEN);
    if (!raw) return;
    if (suggestions.length > 0) {
      const pick = suggestions[Math.min(highlightIdx, suggestions.length - 1)]!;
      addName(pick);
      return;
    }
    addName(raw);
  }, [addName, highlightIdx, input, suggestions]);

  const remove = useCallback((name: string) => {
    setSelected((prev) => prev.filter((x) => x !== name));
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
      <p className="text-xs font-medium text-zinc-500">Design name</p>
      <p className="text-[11px] text-zinc-600">
        Type to search existing names or add a new one.{" "}
        <kbd className="rounded border border-zinc-700 px-0.5">Enter</kbd> picks the highlighted row or saves what you
        typed. First name is the primary design label for this listing.
      </p>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((name, index) => (
            <li
              key={`${name}-${index}`}
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-zinc-600 bg-zinc-900/80 pl-2.5 text-sm text-zinc-200"
            >
              {index === 0 ? (
                <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-500/90">Primary</span>
              ) : null}
              <span className="min-w-0 truncate">{name}</span>
              <button
                type="button"
                onClick={() => remove(name)}
                className="shrink-0 border-l border-zinc-700/80 px-2 py-1 text-zinc-500 hover:text-red-300"
                aria-label={`Remove ${name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative max-w-xl">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          value={input}
          autoComplete="off"
          placeholder="Search or add a design name…"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          onChange={(e) => {
            setInput(e.target.value.slice(0, MAX_DESIGN_NAME_LEN));
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
              addFromInput();
            } else if (e.key === "Backspace" && input === "" && selected.length > 0) {
              remove(selected[selected.length - 1]!);
            } else if (e.key === "Escape") {
              setSuggestionsOpen(false);
            }
          }}
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg"
          >
            {suggestions.map((n, i) => (
              <li key={n} role="presentation">
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
                  onClick={() => addName(n)}
                >
                  {n}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="hidden" aria-hidden>
        {selected.map((n) => (
          <input key={n} type="hidden" name="designNames" value={n} />
        ))}
      </div>
    </div>
  );
}
