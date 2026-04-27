"use client";

import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { mergeKeywordPieces, SEARCH_KEYWORDS_MAX } from "@/lib/search-keywords-normalize";

export type ListingSearchKeywordsChipInputProps = {
  inputId: string;
  disabled?: boolean;
  keywordTokens: string[];
  keywordDraft: string;
  duplicateHint: string | null;
  keywordsJoinedLength: number;
  setKeywordTokens: Dispatch<SetStateAction<string[]>>;
  setKeywordDraft: Dispatch<SetStateAction<string>>;
  setDuplicateHint: Dispatch<SetStateAction<string | null>>;
};

/**
 * Chip-style listing keywords editor (matches request-listing panel): space/enter/comma commits,
 * case-insensitive dedupe, paste split, backspace removes last chip when draft empty.
 */
export function ListingSearchKeywordsChipInput({
  inputId,
  disabled = false,
  keywordTokens,
  keywordDraft,
  duplicateHint,
  keywordsJoinedLength,
  setKeywordTokens,
  setKeywordDraft,
  setDuplicateHint,
}: ListingSearchKeywordsChipInputProps) {
  const keywordInputRef = useRef<HTMLInputElement>(null);

  const addKeywordPieces = useCallback(
    (pieces: string[]) => {
      const cleaned = pieces.map((p) => p.trim()).filter(Boolean);
      if (cleaned.length === 0) return;
      setKeywordTokens((prev) => {
        const { next, skippedDuplicate } = mergeKeywordPieces(prev, cleaned);
        if (skippedDuplicate) {
          queueMicrotask(() => setDuplicateHint("you already have that keyword"));
        }
        return next;
      });
    },
    [setDuplicateHint, setKeywordTokens],
  );

  return (
    <>
      <div
        role="group"
        aria-label="Listing keywords"
        className={`mt-1 flex min-h-[2.75rem] cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 ${
          disabled ? "cursor-not-allowed" : ""
        }`}
        onClick={() => {
          if (!disabled) keywordInputRef.current?.focus();
        }}
      >
        {keywordTokens.map((kw, idx) => (
          <span
            key={`${idx}-${kw}`}
            className="inline-flex max-w-[min(100%,14rem)] items-center gap-0.5 rounded-md border border-zinc-600 bg-zinc-800/90 py-0.5 pl-2 pr-0.5 text-xs text-zinc-200"
          >
            <span className="min-w-0 truncate" title={kw}>
              {kw}
            </span>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove keyword ${kw}`}
              className="flex size-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                setKeywordTokens((prev) => prev.filter((_, i) => i !== idx));
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={inputId}
          ref={keywordInputRef}
          type="text"
          value={keywordDraft}
          autoComplete="off"
          disabled={disabled}
          placeholder={
            keywordTokens.length === 0 ? "Type a word, press Space or Enter…" : "Add another…"
          }
          onChange={(e) => {
            setKeywordDraft(e.target.value);
            setDuplicateHint(null);
          }}
          onPaste={(e) => {
            if (disabled) return;
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            const parts = text.split(/[\s,]+/).filter(Boolean);
            addKeywordPieces(parts);
            setKeywordDraft("");
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " " || e.key === ",") {
              e.preventDefault();
              const raw = keywordDraft.trim();
              if (!raw) return;
              const parts = raw.split(/\s+/).filter(Boolean);
              addKeywordPieces(parts);
              setKeywordDraft("");
              return;
            }
            if (e.key === "Backspace" && keywordDraft === "" && keywordTokens.length > 0) {
              e.preventDefault();
              setKeywordTokens((prev) => prev.slice(0, -1));
            }
          }}
          className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
        />
      </div>
      {duplicateHint ? (
        <p className="mt-1 text-[11px] text-white" role="status" aria-live="polite">
          {duplicateHint}
        </p>
      ) : null}
      <p className="text-[11px] text-zinc-600">
        Press Space or Enter after each word. Total stored: {keywordsJoinedLength}/{SEARCH_KEYWORDS_MAX} characters
      </p>
    </>
  );
}
