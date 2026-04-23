import {
  SITE_EMAIL_ACTION_URL_PLACEHOLDER,
  replaceActionUrlInHtmlTemplate,
} from "@/lib/email-template-placeholders";

/** Matches Resend payload `subject`. */
export const SHOP_PASSWORD_RESET_EMAIL_SUBJECT = "Reset your shop dashboard password";

/** Query `t=` value used only on `/dashboard/preview-reset-email` (development layout check). */
export const SHOP_PASSWORD_RESET_PREVIEW_DEMO_TOKEN = "preview-demo-token";

/**
 * Default full HTML document (same chrome as account deletion emails).
 * `{{ACTION_URL}}` is replaced with the real reset link when sending.
 */
export const SHOP_PASSWORD_RESET_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px 20px;">
          <tr><td>
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fafafa;">Reset your password</p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              You asked to reset your shop dashboard password. Click the button below to choose a new one.
              The link expires in 2 hours.
            </p>
            <p style="margin:0 0 20px;">
              <a href="${SITE_EMAIL_ACTION_URL_PLACEHOLDER}" style="display:inline-block;background:#e4e4e7;color:#18181b;text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:8px;">
                Set a new password
              </a>
            </p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:#71717a;">
              If you did not request this, you can ignore this message.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

/** HTML body sent by Resend for dashboard password reset (single-column, client-safe). */
export function renderShopPasswordResetEmailHtml(template: string, resetUrl: string): string {
  return replaceActionUrlInHtmlTemplate(template, resetUrl);
}

export function buildShopPasswordResetEmailHtml(resetUrl: string): string {
  return renderShopPasswordResetEmailHtml(SHOP_PASSWORD_RESET_HTML_TEMPLATE, resetUrl);
}
