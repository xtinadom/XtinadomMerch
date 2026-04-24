/** Primary admin mailbox address (Resend inbound). Override with `ADMIN_INBOX_EMAIL`. */
export function adminInboxEmailAddress(): string {
  return (process.env.ADMIN_INBOX_EMAIL ?? "info@xtinadom.com").trim().toLowerCase();
}
