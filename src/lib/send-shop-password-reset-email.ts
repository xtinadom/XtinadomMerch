import { emailLinkOrigin } from "@/lib/public-app-url";
import { resolveShopPasswordResetEmail } from "@/lib/site-email-template-service";

type SendResult = { ok: true } | { ok: false; error: string };

function resendUserFacingError(status: number, body: string): string {
  let msg = "";
  try {
    const j = JSON.parse(body) as { message?: string; name?: string };
    if (typeof j?.message === "string" && j.message.trim()) {
      msg = j.message.trim().slice(0, 280);
    }
  } catch {
    if (body.trim()) msg = body.trim().slice(0, 280);
  }
  if (msg) {
    return `Email could not be sent (${status}): ${msg}`;
  }
  return `Email could not be sent (HTTP ${status}). Check Vercel logs for [shop-password-reset].`;
}

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

  console.info(
    `[shop-password-reset] Resend POST from=${JSON.stringify(from)} origin=${JSON.stringify(origin)} toDomain=${JSON.stringify(toEmail.includes("@") ? toEmail.split("@")[1] : "?")}`,
  );

  const { subject, html } = await resolveShopPasswordResetEmail(url);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject,
      html,
    }),
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    console.error("[shop-password-reset] Resend HTTP error", {
      status: res.status,
      body: text.slice(0, 2000),
    });
    return { ok: false, error: resendUserFacingError(res.status, text) };
  }

  let emailId = "";
  try {
    const j = JSON.parse(text) as { id?: string };
    if (typeof j?.id === "string") emailId = j.id;
  } catch {
    /* ignore */
  }
  console.info(
    `[shop-password-reset] Resend accepted email${emailId ? ` id=${emailId}` : ""} (track delivery in Resend → Emails / Logs)`,
  );

  return { ok: true };
}
