/** Matches Resend payload `subject`. */
export const SHOP_EMAIL_VERIFICATION_SUBJECT = "Verify your shop dashboard email";

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function buildShopEmailVerificationHtml(verifyUrl: string): string {
  const href = escapeHtmlAttr(verifyUrl);
  return `<p>Thanks for creating a shop on Xtinadom Merch.</p>
<p><a href="${href}">Verify your email address</a> (link expires in 48 hours).</p>
<p>If you did not create this account, you can ignore this email.</p>`;
}
