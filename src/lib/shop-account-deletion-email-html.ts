export const SHOP_ACCOUNT_DELETION_SUBJECT = "Confirm account deletion";

export function buildShopAccountDeletionConfirmHtml(confirmUrl: string): string {
  const safe = confirmUrl.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px 20px;">
          <tr><td>
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fafafa;">Confirm account deletion</p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              Your shop was frozen when you requested deletion. Click the button below to confirm this email.
              Your account can only be removed after any Stripe payout balance is zero.
            </p>
            <p style="margin:0 0 20px;">
              <a href="${safe}" style="display:inline-block;background:#e4e4e7;color:#18181b;text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:8px;">
                Confirm deletion email
              </a>
            </p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:#71717a;">
              If you did not request this, you can ignore this message. The link expires in 24 hours.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
