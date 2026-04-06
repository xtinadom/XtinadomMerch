"use client";

import { useCallback, useMemo, useState } from "react";
import type { Tag } from "@/generated/prisma/client";

export type AdminTagRow = Pick<Tag, "id" | "slug" | "name" | "sortOrder">;

type Props = {
  tags: AdminTagRow[];
  defaultTagIds: string[];
};

export function ProductTagFields({ tags: allTags, defaultTagIds }: Props) {
  const tags = useMemo(
    () =>
      [...allTags].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    [allTags],
  );

  const [selected, setSelected] = useState<string[]>(() => {
    const allowed = new Set(tags.map((t) => t.id));
    return defaultTagIds.filter((id) => allowed.has(id));
  });

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }, []);

  const moveUp = useCallback((id: string) => {
    setSelected((prev) => {
      const i = prev.indexOf(id);
      if (i <= 0) return prev;
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
      return next;
    });
  }, []);

  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-500">Tags</p>
      <p className="text-[11px] text-zinc-600">
        First tag is the primary label on product cards. Reorder with “Move up”.
      </p>
      <ul className="space-y-1.5">
        {tags.map((t) => {
          const on = selected.includes(t.id);
          return (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-2 text-sm text-zinc-300"
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(t.id)}
                  className="rounded border-zinc-600"
                />
                <span>{t.name}</span>
              </label>
              {on ? (
                <button
                  type="button"
                  onClick={() => moveUp(t.id)}
                  className="text-[10px] text-zinc-500 underline hover:text-zinc-300"
                >
                  Move up
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="hidden" aria-hidden>
        {selected.map((id) => (
          <input key={id} type="hidden" name="tagIds" value={id} />
        ))}
      </div>
      {selected.length > 0 ? (
        <p className="text-[11px] text-zinc-600">
          Order:{" "}
          {selected
            .map((id) => byId.get(id)?.name ?? id)
            .join(" → ")}
        </p>
      ) : null}
    </div>
  );
}
