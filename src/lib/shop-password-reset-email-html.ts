/** Matches Resend payload `subject`. */
export const SHOP_PASSWORD_RESET_EMAIL_SUBJECT = "Reset your shop dashboard password";

/** Query `t=` value used only on `/dashboard/preview-reset-email` (development layout check). */
export const SHOP_PASSWORD_RESET_PREVIEW_DEMO_TOKEN = "preview-demo-token";

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** HTML body sent by Resend for dashboard password reset (single-column, client-safe). */
export function buildShopPasswordResetEmailHtml(resetUrl: string): string {
  const href = escapeHtmlAttr(resetUrl);
  return `<p>You asked to reset your shop dashboard password.</p>
<p><a href="${href}">Set a new password</a> (link expires in 2 hours).</p>
<p>If you did not request this, you can ignore this email.</p>`;
}
