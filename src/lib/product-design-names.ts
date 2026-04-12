import type { Prisma } from "@/generated/prisma/client";

const MAX = 12;

export function designNamesFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of value) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, 80);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX) break;
  }
  return out;
}

export function toDesignNamesJson(names: string[]): Prisma.InputJsonValue {
  return names;
}

/** Distinct non-empty design names from products (for admin typeahead). */
export function collectKnownDesignNamesFromProducts(
  products: { designNames: Prisma.JsonValue | null }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of products) {
    for (const n of designNamesFromJson(p.designNames)) {
      const k = n.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
