"use server";

import { redirect } from "next/navigation";
import { createPrintifyWebhook, listPrintifyWebhooks } from "@/lib/printify";
import { webhookPublicBaseUrl } from "@/lib/public-app-url";
import { getAdminSession } from "@/lib/session";

const WEBHOOK_TOPIC = "order:created";

/** Registers this site’s HTTPS URL with Printify so they can POST order events (standard API integration). */
export async function registerPrintifyStorefrontWebhook(): Promise<void> {
  const session = await getAdminSession();
  if (!session.isAdmin) {
    redirect("/admin/login");
  }

  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  const secret = process.env.PRINTIFY_WEBHOOK_SECRET?.trim();
  const base = webhookPublicBaseUrl();

  if (!shopId) {
    redirect("/admin?tab=printify-api&pfyHook=err&pfyHookReason=no_shop");
  }
  if (!secret || secret.length < 16) {
    redirect("/admin?tab=printify-api&pfyHook=err&pfyHookReason=no_secret");
  }
  if (!base) {
    redirect("/admin?tab=printify-api&pfyHook=err&pfyHookReason=no_public_url");
  }

  const url = `${base}/api/webhooks/printify`;

  let existing: Awaited<ReturnType<typeof listPrintifyWebhooks>>;
  try {
    existing = await listPrintifyWebhooks(shopId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirect(
      `/admin?tab=printify-api&pfyHook=err&pfyHookReason=${encodeURIComponent(msg.slice(0, 240))}`,
    );
  }

  const already = existing.some((w) => w.topic === WEBHOOK_TOPIC && w.url === url);
  if (already) {
    redirect("/admin?tab=printify-api&pfyHook=ok&pfyHookDetail=already");
  }

  const created = await createPrintifyWebhook(shopId, {
    topic: WEBHOOK_TOPIC,
    url,
    secret,
  });

  if (!created.ok) {
    const snippet = created.body.replace(/\s+/g, " ").slice(0, 240);
    redirect(
      `/admin?tab=printify-api&pfyHook=err&pfyHookReason=${encodeURIComponent(`api_${created.status}: ${snippet}`)}`,
    );
  }

  redirect("/admin?tab=printify-api&pfyHook=ok");
}
