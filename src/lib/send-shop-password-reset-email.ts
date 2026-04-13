import { emailLinkOrigin } from "@/lib/public-app-url";

type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Sends dashboard password-reset email via Resend when `RESEND_API_KEY` is set.
 * In development without Resend, logs the link to the server console.
 */
export async function sendShopPasswordResetEmail(
  toEmail: string,
  rawToken: string,
): Promise<SendResult> {
  const origin = emailLinkOrigin();
  const url = `${origin}/dashboard/reset-password?t=${encodeURIComponent(rawToken)}`;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM?.trim() ||
    "Xtinadom Merch <onboarding@resend.dev>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[shop-password-reset] (no RESEND_API_KEY) reset link for ${toEmail}:\n${url}`);
      return { ok: true };
    }
    return {
      ok: false,
      error:
        "Email is not configured: set RESEND_API_KEY in the server environment (e.g. Vercel → Settings → Environment Variables), then redeploy.",
    };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject: "Reset your shop dashboard password",
      html: `<p>You asked to reset your shop dashboard password.</p>
<p><a href="${url}">Set a new password</a> (link expires in 2 hours).</p>
<p>If you did not request this, you can ignore this email.</p>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[shop-password-reset] Resend error", res.status, text);
    return { ok: false, error: "Could not send email. Try again later." };
  }

  return { ok: true };
}
