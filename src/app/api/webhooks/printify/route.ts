import { createHmac, timingSafeEqual } from "node:crypto";

function verifyPrintifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.trim()) return false;
  const received = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(received)) return false;
  const expectedHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(received, "hex");
    const b = Buffer.from(expectedHex, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Printify → your storefront: order and catalog events.
 * Register this URL in Admin → Printify API (sends PRINTIFY_WEBHOOK_SECRET to Printify on create).
 */
export async function POST(request: Request) {
  const secret = process.env.PRINTIFY_WEBHOOK_SECRET?.trim();
  const raw = await request.text();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return new Response("Webhook secret not configured", { status: 503 });
    }
    /* Dev without secret: accept (do not use in production). */
    return new Response("ok", { status: 200 });
  }

  const sig =
    request.headers.get("x-pfy-signature") ??
    request.headers.get("X-Pfy-Signature") ??
    request.headers.get("X-Printify-Signature");

  if (!verifyPrintifySignature(raw, sig, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  return new Response("ok", { status: 200 });
}
