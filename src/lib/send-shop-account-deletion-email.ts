import { emailLinkOrigin } from "@/lib/public-app-url";
import { resolveShopAccountDeletionConfirmEmail } from "@/lib/site-email-template-service";

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
  return `Email could not be sent (HTTP ${status}). Check Vercel logs for [shop-account-deletion].`;
}

export async function sendShopAccountDeletionConfirmEmail(
  toEmail: string,
  rawToken: string,
): Promise<SendResult> {
  const origin = emailLinkOrigin();
  const url = `${origin}/dashboard/account-deletion/confirm?t=${encodeURIComponent(rawToken)}`;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.SHOP_ACCOUNT_DELETION_EMAIL_FROM?.trim() ||
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM?.trim() ||
    "Xtinadom Merch <onboarding@resend.dev>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[shop-account-deletion] (no RESEND_API_KEY) link for ${toEmail}:\n${url}`);
      return { ok: true };
    }
    return {
      ok: false,
      error:
        "Email is not configured: set RESEND_API_KEY in the server environment, then redeploy.",
    };
  }

  const { subject, html } = await resolveShopAccountDeletionConfirmEmail(url);

  console.info(
    `[shop-account-deletion] Resend POST from=${JSON.stringify(from)} origin=${JSON.stringify(origin)} toDomain=${JSON.stringify(toEmail.includes("@") ? toEmail.split("@")[1] : "?")}`,
  );

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

  const body = await res.text();
  if (!res.ok) {
    console.error("[shop-account-deletion] Resend HTTP error", {
      status: res.status,
      body: body.slice(0, 2000),
    });
    return { ok: false, error: resendUserFacingError(res.status, body) };
  }

  let emailId = "";
  try {
    const j = JSON.parse(body) as { id?: string };
    if (typeof j?.id === "string") emailId = j.id;
  } catch {
    /* ignore */
  }
  console.info(
    `[shop-account-deletion] Resend accepted email${emailId ? ` id=${emailId}` : ""} (track delivery in Resend → Emails / Logs)`,
  );

  return { ok: true };
}
