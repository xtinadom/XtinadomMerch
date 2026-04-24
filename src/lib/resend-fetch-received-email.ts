const MAX_BODY_CHARS = 500_000;

function truncate(s: string | null | undefined): string | null {
  if (s == null || s === "") return null;
  if (s.length <= MAX_BODY_CHARS) return s;
  return `${s.slice(0, MAX_BODY_CHARS)}\n\n[truncated]`;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "email" in item) {
          return String((item as { email: unknown }).email);
        }
        return String(item);
      })
      .filter((s) => s.length > 0)
      .join(", ");
  }
  if (v == null) return "";
  return String(v);
}

function parseReceivedAt(v: unknown): Date {
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Fetches a single received (inbound) message from Resend’s Receiving API.
 * @see https://resend.com/docs/api-reference/emails/retrieve-received-email
 */
export async function resendFetchReceivedEmail(emailId: string): Promise<{
  fromAddress: string;
  toAddress: string;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  receivedAt: Date;
}> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Resend receiving HTTP ${res.status}: ${raw.slice(0, 400)}`);
  }

  let j: Record<string, unknown>;
  try {
    j = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("Resend receiving: invalid JSON");
  }

  const row = (j.data && typeof j.data === "object" ? j.data : j) as Record<string, unknown>;

  return {
    fromAddress: asString(row.from ?? row.sender).trim() || "(unknown)",
    toAddress: asString(row.to ?? row.recipients).trim() || "(unknown)",
    subject: asString(row.subject).trim() || "(no subject)",
    textBody: truncate(typeof row.text === "string" ? row.text : null),
    htmlBody: truncate(typeof row.html === "string" ? row.html : null),
    receivedAt: parseReceivedAt(row.created_at ?? row.createdAt ?? row.received_at),
  };
}
