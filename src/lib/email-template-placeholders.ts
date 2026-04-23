/** Placeholder for the signed action URL in HTML shop emails (admin-editable templates). */
export const SITE_EMAIL_ACTION_URL_PLACEHOLDER = "{{ACTION_URL}}";

export function replaceActionUrlInHtmlTemplate(template: string, actionUrl: string): string {
  const escaped = actionUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  return template.split(SITE_EMAIL_ACTION_URL_PLACEHOLDER).join(escaped);
}

export const CONTACT_QUOTE_NAME_PLACEHOLDER = "{{CONTACT_NAME}}";
export const CONTACT_QUOTE_EMAIL_PLACEHOLDER = "{{CONTACT_EMAIL}}";
export const CONTACT_QUOTE_MESSAGE_PLACEHOLDER = "{{CONTACT_MESSAGE}}";

export function replaceContactQuotePlaceholders(
  template: string,
  vars: { name: string; email: string; message: string },
): string {
  return template
    .split(CONTACT_QUOTE_NAME_PLACEHOLDER)
    .join(vars.name)
    .split(CONTACT_QUOTE_EMAIL_PLACEHOLDER)
    .join(vars.email)
    .split(CONTACT_QUOTE_MESSAGE_PLACEHOLDER)
    .join(vars.message);
}

/** Wraps a fragment so iframe / mail clients show a full document (preview helper). */
export function wrapEmailHtmlFragmentForPreview(fragmentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:24px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.55;color:#18181b;background:#f4f4f5;">
${fragmentHtml}
</body>
</html>`;
}
