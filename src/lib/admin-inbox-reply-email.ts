import { adminInboxEmailAddress } from "@/lib/admin-inbox-config";

export type AdminInboxSendResult = { ok: true } | { ok: false; error: string };

/**
 * Parse `From` for a single reply address (handles `Name <email@host>` and bare `email@host`).
 */
export function extractReplyToAddress(fromHeader: string): string | null {
  const raw = fromHeader.trim();
  if (!raw) return null;
  const angle = raw.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  const token = raw.split(/\s+/).find((p) => p.includes("@"));
  if (token && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token)) return token.trim().toLowerCase();
  return null;
}

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
  if (msg) return `Resend (${status}): ${msg}`;
  return `Resend returned HTTP ${status}. Check server logs for [admin-inbox-reply].`;
}

/**
 * Sends a plain-text reply via Resend from the admin inbox address (domain must be verified for sending).
 */
export async function sendOutboundAdminInboxReply(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<AdminInboxSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const inbox = adminInboxEmailAddress();
  const from =
    process.env.ADMIN_INBOX_REPLY_FROM?.trim() ||
    `Xtinadom <${inbox}>`;

  if (!apiKey) {
    return {
      ok: false,
      error:
        "RESEND_API_KEY is not set. Add your Resend API key so replies can be sent from this environment.",
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
      to: [opts.to],
      reply_to: inbox,
      subject: opts.subject,
      text: opts.text,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("[admin-inbox-reply] Resend HTTP error", {
      status: res.status,
      body: body.slice(0, 2000),
    });
    return { ok: false, error: resendUserFacingError(res.status, body) };
  }

  return { ok: true };
}
