/** Ordered tag ids from admin product forms (first = primary). */
export function parseProductTagIdsFromForm(formData: FormData): string[] {
  const fromList = formData
    .getAll("tagIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (fromList.length > 0) return [...new Set(fromList)];
  const legacy = String(formData.get("primaryTagId") ?? "").trim();
  return legacy ? [legacy] : [];
}
