/** Max design name strings per product (admin). */
export const MAX_DESIGN_NAMES_PER_PRODUCT = 12;

/** Max length of one design name label. */
export const MAX_DESIGN_NAME_LEN = 80;

/** Ordered design names from admin product forms (first = primary). */
export function parseDesignNamesFromForm(formData: FormData): string[] {
  const raw = formData
    .getAll("designNames")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const t = s.slice(0, MAX_DESIGN_NAME_LEN);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_DESIGN_NAMES_PER_PRODUCT) break;
  }
  return out;
}
