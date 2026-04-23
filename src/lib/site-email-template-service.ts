import { prisma } from "@/lib/prisma";
import { replaceContactQuotePlaceholders } from "@/lib/email-template-placeholders";
import {
  MERCH_QUOTE_DEFAULT_SUBJECT_TEMPLATE,
  MERCH_QUOTE_DEFAULT_TEXT_TEMPLATE,
} from "@/lib/merch-quote-email-defaults";
import {
  SHOP_ACCOUNT_DELETION_HTML_TEMPLATE,
  SHOP_ACCOUNT_DELETION_SUBJECT,
  renderShopAccountDeletionConfirmHtml,
} from "@/lib/shop-account-deletion-email-html";
import {
  SHOP_EMAIL_VERIFICATION_HTML_TEMPLATE,
  SHOP_EMAIL_VERIFICATION_SUBJECT,
  renderShopEmailVerificationHtml,
} from "@/lib/shop-email-verification-email-html";
import {
  SHOP_PASSWORD_RESET_EMAIL_SUBJECT,
  SHOP_PASSWORD_RESET_HTML_TEMPLATE,
  renderShopPasswordResetEmailHtml,
} from "@/lib/shop-password-reset-email-html";
import type { SiteEmailTemplateKey } from "@/lib/site-email-template-keys";

export type AdminEmailFormatEntry = {
  key: SiteEmailTemplateKey;
  label: string;
  kind: "html" | "text";
  description: string;
  subject: string;
  body: string;
  defaultSubject: string;
  defaultBody: string;
  sampleActionUrl: string | null;
  samplePreview: { name: string; email: string; message: string };
};

export function sampleActionUrlsForAdmin(origin: string): Record<
  | "shop_dashboard_email_verification"
  | "shop_dashboard_password_reset"
  | "shop_dashboard_account_deletion_confirm",
  string
> {
  const o = origin.replace(/\/$/, "");
  return {
    shop_dashboard_email_verification: `${o}/dashboard/verify-email?t=__preview__`,
    shop_dashboard_password_reset: `${o}/dashboard/reset-password?t=__preview__`,
    shop_dashboard_account_deletion_confirm: `${o}/dashboard/account-deletion/confirm?t=__preview__`,
  };
}

const SAMPLE_QUOTE = {
  name: "Jordan Example",
  email: "jordan@example.com",
  message:
    "Hi — we are interested in a small merch run (tees + stickers) for an upcoming tour. Roughly 100 units to start.",
} as const;

export function buildAdminEmailFormatEntries(
  rows: { key: string; subject: string | null; htmlBody: string | null; textBody: string | null }[],
  origin: string,
): AdminEmailFormatEntry[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const actionSamples = sampleActionUrlsForAdmin(origin);

  const pick = (key: SiteEmailTemplateKey) => byKey.get(key);

  const verification = pick("shop_dashboard_email_verification");
  const password = pick("shop_dashboard_password_reset");
  const deletion = pick("shop_dashboard_account_deletion_confirm");
  const quote = pick("merch_quote_contact_inquiry");

  return [
    {
      key: "shop_dashboard_email_verification",
      label: "Shop dashboard — verify email",
      kind: "html",
      description:
        "Sent when a creator signs up or changes dashboard email. Full HTML document; use {{ACTION_URL}} for the verification button link.",
      defaultSubject: SHOP_EMAIL_VERIFICATION_SUBJECT,
      defaultBody: SHOP_EMAIL_VERIFICATION_HTML_TEMPLATE,
      subject: verification?.subject?.trim() || SHOP_EMAIL_VERIFICATION_SUBJECT,
      body: verification?.htmlBody?.trim() || SHOP_EMAIL_VERIFICATION_HTML_TEMPLATE,
      sampleActionUrl: actionSamples.shop_dashboard_email_verification,
      samplePreview: SAMPLE_QUOTE,
    },
    {
      key: "shop_dashboard_password_reset",
      label: "Shop dashboard — password reset",
      kind: "html",
      description:
        "Sent from forgot-password flow. Full HTML document; use {{ACTION_URL}} for the reset button link (expires in 2 hours).",
      defaultSubject: SHOP_PASSWORD_RESET_EMAIL_SUBJECT,
      defaultBody: SHOP_PASSWORD_RESET_HTML_TEMPLATE,
      subject: password?.subject?.trim() || SHOP_PASSWORD_RESET_EMAIL_SUBJECT,
      body: password?.htmlBody?.trim() || SHOP_PASSWORD_RESET_HTML_TEMPLATE,
      sampleActionUrl: actionSamples.shop_dashboard_password_reset,
      samplePreview: SAMPLE_QUOTE,
    },
    {
      key: "shop_dashboard_account_deletion_confirm",
      label: "Shop dashboard — confirm account deletion",
      kind: "html",
      description:
        "Sent when a shop requests account deletion. Full HTML document; use {{ACTION_URL}} for the confirmation button link.",
      defaultSubject: SHOP_ACCOUNT_DELETION_SUBJECT,
      defaultBody: SHOP_ACCOUNT_DELETION_HTML_TEMPLATE,
      subject: deletion?.subject?.trim() || SHOP_ACCOUNT_DELETION_SUBJECT,
      body: deletion?.htmlBody?.trim() || SHOP_ACCOUNT_DELETION_HTML_TEMPLATE,
      sampleActionUrl: actionSamples.shop_dashboard_account_deletion_confirm,
      samplePreview: SAMPLE_QUOTE,
    },
    {
      key: "merch_quote_contact_inquiry",
      label: "Merch quote — contact form (internal)",
      kind: "text",
      description:
        "Plain text email to CONTACT_QUOTE_TO_EMAIL when someone uses the merch quote form. Placeholders: {{CONTACT_NAME}}, {{CONTACT_EMAIL}}, {{CONTACT_MESSAGE}}.",
      defaultSubject: MERCH_QUOTE_DEFAULT_SUBJECT_TEMPLATE,
      defaultBody: MERCH_QUOTE_DEFAULT_TEXT_TEMPLATE,
      subject: quote?.subject?.trim() || MERCH_QUOTE_DEFAULT_SUBJECT_TEMPLATE,
      body: quote?.textBody?.trim() || MERCH_QUOTE_DEFAULT_TEXT_TEMPLATE,
      sampleActionUrl: null,
      samplePreview: SAMPLE_QUOTE,
    },
  ];
}

export async function resolveShopEmailVerificationEmail(verifyUrl: string): Promise<{
  subject: string;
  html: string;
}> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "shop_dashboard_email_verification" },
  });
  const htmlTpl = row?.htmlBody?.trim() ? row.htmlBody : SHOP_EMAIL_VERIFICATION_HTML_TEMPLATE;
  const subject = row?.subject?.trim() ? row.subject : SHOP_EMAIL_VERIFICATION_SUBJECT;
  return {
    subject,
    html: renderShopEmailVerificationHtml(htmlTpl, verifyUrl),
  };
}

export async function resolveShopPasswordResetEmail(resetUrl: string): Promise<{
  subject: string;
  html: string;
}> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "shop_dashboard_password_reset" },
  });
  const htmlTpl = row?.htmlBody?.trim() ? row.htmlBody : SHOP_PASSWORD_RESET_HTML_TEMPLATE;
  const subject = row?.subject?.trim() ? row.subject : SHOP_PASSWORD_RESET_EMAIL_SUBJECT;
  return {
    subject,
    html: renderShopPasswordResetEmailHtml(htmlTpl, resetUrl),
  };
}

export async function resolveShopAccountDeletionConfirmEmail(confirmUrl: string): Promise<{
  subject: string;
  html: string;
}> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "shop_dashboard_account_deletion_confirm" },
  });
  const htmlTpl = row?.htmlBody?.trim() ? row.htmlBody : SHOP_ACCOUNT_DELETION_HTML_TEMPLATE;
  const subject = row?.subject?.trim() ? row.subject : SHOP_ACCOUNT_DELETION_SUBJECT;
  return {
    subject,
    html: renderShopAccountDeletionConfirmHtml(htmlTpl, confirmUrl),
  };
}

export async function resolveMerchQuoteContactEmail(parts: {
  name: string;
  email: string;
  message: string;
}): Promise<{ subject: string; text: string }> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "merch_quote_contact_inquiry" },
  });
  const subjTpl = row?.subject?.trim() ? row.subject : MERCH_QUOTE_DEFAULT_SUBJECT_TEMPLATE;
  const textTpl = row?.textBody?.trim() ? row.textBody : MERCH_QUOTE_DEFAULT_TEXT_TEMPLATE;
  return {
    subject: replaceContactQuotePlaceholders(subjTpl, parts),
    text: replaceContactQuotePlaceholders(textTpl, parts),
  };
}
