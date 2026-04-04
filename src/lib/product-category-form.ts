/** Read ordered category assignments from admin product forms. */
export function parseProductCategoryIdsFromForm(formData: FormData): string[] {
  const raw = formData
    .getAll("categoryIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const legacy = String(formData.get("categoryId") ?? "").trim();
  const merged = raw.length > 0 ? raw : legacy ? [legacy] : [];
  return [...new Set(merged)];
}
