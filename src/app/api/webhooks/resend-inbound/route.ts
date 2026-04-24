import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma, prismaAdminInboundEmailOrNull } from "@/lib/prisma";
import { adminInboxEmailAddress } from "@/lib/admin-inbox-config";
import { resendFetchReceivedEmail } from "@/lib/resend-fetch-received-email";
import { revalidatePath } from "next/cache";
import { ADMIN_BACKEND_BASE_PATH, ADMIN_MAIN_BASE_PATH } from "@/lib/admin-dashboard-urls";

export const runtime = "nodejs";

function webhookSecret(): string | undefined {
  return (
    process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim() ||
    process.env.RESEND_WEBHOOK_SECRET?.trim() ||
    undefined
  );
}

function extractEmailReceivedId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  const data = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : o;
  const id = data.email_id ?? data.id ?? data.emailId;
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

function extractEventType(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const t = (payload as Record<string, unknown>).type;
  return typeof t === "string" ? t : null;
}

function toFieldMatchesInbox(toDisplay: string, rawPayload: unknown): boolean {
  const want = adminInboxEmailAddress();
  const blob = toDisplay.toLowerCase();
  if (blob.includes(want)) return true;
  if (!rawPayload || typeof rawPayload !== "object") return false;
  const o = rawPayload as Record<string, unknown>;
  const data = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : o;
  const rawTo = data.to ?? data.recipients;
  if (Array.isArray(rawTo)) {
    return rawTo.some((x) => String(x).toLowerCase().includes(want));
  }
  if (typeof rawTo === "string") {
    return rawTo.toLowerCase().includes(want);
  }
  return false;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = webhookSecret();

  if (process.env.NODE_ENV === "production" && !secret) {
    console.error("[resend-inbound] Missing RESEND_INBOUND_WEBHOOK_SECRET or RESEND_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  if (secret) {
    const svixId = req.headers.get("svix-id");
    const svixTs = req.headers.get("svix-timestamp");
    const svixSig = req.headers.get("svix-signature");
    if (!svixId || !svixTs || !svixSig) {
      return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
    }
    try {
      new Webhook(secret).verify(rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTs,
        "svix-signature": svixSig,
      });
    } catch (e) {
      console.error("[resend-inbound] Svix verify failed", e);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = extractEventType(payload);
  if (eventType !== "email.received") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const emailId = extractEmailReceivedId(payload);
  if (!emailId) {
    console.error("[resend-inbound] No email id in payload", JSON.stringify(payload).slice(0, 500));
    return NextResponse.json({ error: "No email id" }, { status: 400 });
  }

  try {
    const mail = await resendFetchReceivedEmail(emailId);
    if (!toFieldMatchesInbox(mail.toAddress, payload)) {
      return NextResponse.json({ ok: true, skipped: "not_inbox_address" });
    }

    const inbound = prismaAdminInboundEmailOrNull();
    if (!inbound) {
      console.error(
        "[resend-inbound] prisma.adminInboundEmail missing (stale Prisma singleton). Restart the server after `npx prisma generate`.",
      );
      return NextResponse.json({ error: "Inbound storage not available" }, { status: 503 });
    }

    await inbound.upsert({
      where: { resendEmailId: emailId },
      create: {
        resendEmailId: emailId,
        fromAddress: mail.fromAddress,
        toAddress: mail.toAddress,
        subject: mail.subject,
        textBody: mail.textBody,
        htmlBody: mail.htmlBody,
        receivedAt: mail.receivedAt,
      },
      update: {
        fromAddress: mail.fromAddress,
        toAddress: mail.toAddress,
        subject: mail.subject,
        textBody: mail.textBody,
        htmlBody: mail.htmlBody,
        receivedAt: mail.receivedAt,
      },
    });

    revalidatePath(ADMIN_MAIN_BASE_PATH);
    revalidatePath(ADMIN_BACKEND_BASE_PATH);
  } catch (e) {
    console.error("[resend-inbound] persist failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to store email" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
