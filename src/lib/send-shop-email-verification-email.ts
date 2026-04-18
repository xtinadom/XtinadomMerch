import { emailLinkOrigin } from "@/lib/public-app-url";
import {
  SHOP_EMAIL_VERIFICATION_SUBJECT,
  buildShopEmailVerificationHtml,
} from "@/lib/shop-email-verification-email-html";

type SendResult = { ok: true } | { ok: false; error: string };

function resendUserFacingError(status: number, body: string): string {
  let msg = "";
  try {
    const j = JSON.parse(body) as { message?: string };
    if (typeof j?.message === "string" && j.message.trim()) {
      msg = j.message.trim().slice(0, 280);
    }
  } catch {
    if (body.trim()) msg = body.trim().slice(0, 280);
  }
  if (msg) {
    return `Email could not be sent (${status}): ${msg}`;
  }
  return `Email could not be sent (HTTP ${status}).`;
}

export async function sendShopEmailVerificationEmail(
  toEmail: string,
  rawToken: string,
): Promise<SendResult> {
  const origin = emailLinkOrigin();
  const url = `${origin}/dashboard/verify-email?t=${encodeURIComponent(rawToken)}`;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.SHOP_EMAIL_VERIFICATION_EMAIL_FROM?.trim() ||
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM?.trim() ||
    "Xtinadom Merch <onboarding@resend.dev>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[shop-email-verify] (no RESEND_API_KEY) link for ${toEmail}:\n${url}`);
      return { ok: true };
    }
    return {
      ok: false,
      error:
        "Email is not configured: set RESEND_API_KEY in the server environment, then redeploy.",
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
      subject: SHOP_EMAIL_VERIFICATION_SUBJECT,
      html: buildShopEmailVerificationHtml(url),
    }),
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    console.error("[shop-email-verify] Resend HTTP error", {
      status: res.status,
      body: text.slice(0, 2000),
    });
    return { ok: false, error: resendUserFacingError(res.status, text) };
  }

  return { ok: true };
}
