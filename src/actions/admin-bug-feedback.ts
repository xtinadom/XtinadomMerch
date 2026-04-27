"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function adminUpdateBugFeedbackReport(formData: FormData): Promise<void> {
  await requireAdmin();
  const reportId = String(formData.get("reportId") ?? "").trim();
  if (!reportId) return;

  const resolvedRaw = String(formData.get("resolved") ?? "").trim();
  const resolved =
    resolvedRaw === "1" ? true : resolvedRaw === "0" ? false : undefined;
  const adminNotesRaw = String(formData.get("adminNotes") ?? "");
  const adminNotes = adminNotesRaw.trim() ? adminNotesRaw : null;

  await prisma.bugFeedbackReport.update({
    where: { id: reportId },
    data: {
      ...(resolved === true ? { resolvedAt: new Date() } : {}),
      ...(resolved === false ? { resolvedAt: null } : {}),
      ...(adminNotesRaw !== undefined ? { adminNotes } : {}),
    },
  });

  revalidatePath("/admin");
}

