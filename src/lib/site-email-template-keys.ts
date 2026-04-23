export const SITE_EMAIL_TEMPLATE_KEYS = [
  "shop_dashboard_email_verification",
  "shop_dashboard_password_reset",
  "shop_dashboard_account_deletion_confirm",
  "merch_quote_contact_inquiry",
] as const;

export type SiteEmailTemplateKey = (typeof SITE_EMAIL_TEMPLATE_KEYS)[number];

export function isSiteEmailTemplateKey(s: string): s is SiteEmailTemplateKey {
  return (SITE_EMAIL_TEMPLATE_KEYS as readonly string[]).includes(s);
}
