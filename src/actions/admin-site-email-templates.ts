"use server";

import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { isSiteEmailTemplateKey } from "@/lib/site-email-template-keys";

const SUBJECT_MAX = 500;
const HTML_MAX = 200_000;
const TEXT_MAX = 50_000;

export type AdminSaveSiteEmailTemplateResult =
  | { ok: true }
  | { ok: false; error: string };

export async function adminSaveSiteEmailTemplate(
  _prev: AdminSaveSiteEmailTemplateResult | undefined,
  formData: FormData,
): Promise<AdminSaveSiteEmailTemplateResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const keyRaw = String(formData.get("key") ?? "").trim();
  if (!isSiteEmailTemplateKey(keyRaw)) {
    return { ok: false, error: "Unknown template." };
  }

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");

  if (!subject) {
    return { ok: false, error: "Subject is required." };
  }
  if (subject.length > SUBJECT_MAX) {
    return { ok: false, error: "Subject is too long." };
  }

  const isQuote = keyRaw === "merch_quote_contact_inquiry";
  if (isQuote) {
    if (!body.trim()) {
      return { ok: false, error: "Message body is required." };
    }
    if (body.length > TEXT_MAX) {
      return { ok: false, error: "Body is too long." };
    }
    await prisma.siteEmailTemplate.upsert({
      where: { key: keyRaw },
      create: { key: keyRaw, subject, textBody: body, htmlBody: null },
      update: { subject, textBody: body, htmlBody: null },
    });
  } else {
    if (!body.trim()) {
      return { ok: false, error: "HTML body is required." };
    }
    if (body.length > HTML_MAX) {
      return { ok: false, error: "HTML body is too long." };
    }
    if (!body.includes("{{ACTION_URL}}")) {
      return {
        ok: false,
        error:
          "HTML must include {{ACTION_URL}} wherever the signed action link should appear when sending.",
      };
    }
    await prisma.siteEmailTemplate.upsert({
      where: { key: keyRaw },
      create: { key: keyRaw, subject, htmlBody: body, textBody: null },
      update: { subject, htmlBody: body, textBody: null },
    });
  }

  revalidateAdminViews();
  return { ok: true };
}

export async function adminResetSiteEmailTemplate(formData: FormData): Promise<void> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const keyRaw = String(formData.get("key") ?? "").trim();
  if (!isSiteEmailTemplateKey(keyRaw)) return;

  await prisma.siteEmailTemplate.deleteMany({ where: { key: keyRaw } });
  revalidateAdminViews();
}
