"use server";

import { redirect } from "next/navigation";
import { prismaAdminInboundEmailOrNull } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import {
  extractReplyToAddress,
  sendOutboundAdminInboxReply,
} from "@/lib/admin-inbox-reply-email";
import {
  ADMIN_INBOX_REPLY_BODY_MAX,
  type AdminInboxReplyState,
} from "@/lib/admin-inbox-reply-shared";

export async function sendAdminInboxReply(
  _prev: AdminInboxReplyState,
  formData: FormData,
): Promise<AdminInboxReplyState> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const inboundId = String(formData.get("inboundId") ?? "").trim();
  const bodyRaw = formData.get("body");
  const body = typeof bodyRaw === "string" ? bodyRaw.trim() : "";
  if (!inboundId) {
    return { status: "error", message: "Missing message id." };
  }
  if (!body) {
    return { status: "error", message: "Write a message before sending." };
  }
  if (body.length > ADMIN_INBOX_REPLY_BODY_MAX) {
    return {
      status: "error",
      message: `Message is too long (max ${ADMIN_INBOX_REPLY_BODY_MAX} characters).`,
    };
  }

  const delegate = prismaAdminInboundEmailOrNull();
  if (!delegate) {
    return {
      status: "error",
      message: "Inbox is unavailable in this process. Restart the server after `npx prisma generate`.",
    };
  }

  const row = await delegate.findUnique({
    where: { id: inboundId },
    select: { id: true, fromAddress: true, subject: true },
  });
  if (!row) {
    return { status: "error", message: "That message no longer exists." };
  }

  const to = extractReplyToAddress(row.fromAddress);
  if (!to) {
    return {
      status: "error",
      message: "Could not parse a reply address from the sender (From) field.",
    };
  }

  const subj = row.subject.trim() || "(no subject)";
  const replySubject = /^re:\s/i.test(subj) ? subj : `Re: ${subj}`;
  const clippedSubject =
    replySubject.length > 998 ? `${replySubject.slice(0, 995)}…` : replySubject;

  const sent = await sendOutboundAdminInboxReply({
    to,
    subject: clippedSubject,
    text: body,
  });
  if (!sent.ok) {
    return { status: "error", message: sent.error };
  }

  revalidateAdminViews();
  return { status: "success" };
}
