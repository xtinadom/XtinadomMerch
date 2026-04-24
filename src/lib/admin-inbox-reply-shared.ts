export const ADMIN_INBOX_REPLY_BODY_MAX = 20_000;

export type AdminInboxReplyState =
  | null
  | { status: "success" }
  | { status: "error"; message: string };
