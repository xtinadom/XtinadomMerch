"use server";

import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  email: z.string().trim().email("Enter a valid email.").max(320),
  message: z.string().trim().min(10, "Please write at least a few sentences.").max(8000),
});

export type MerchQuoteFormState =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function submitMerchQuoteContact(
  _prev: MerchQuoteFormState,
  formData: FormData,
): Promise<MerchQuoteFormState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "Check your input.";
    return { ok: false, error: msg };
  }

  const { name, email, message } = parsed.data;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.CONTACT_QUOTE_TO_EMAIL?.trim();
  const from =
    process.env.CONTACT_QUOTE_FROM_EMAIL?.trim() ?? "onboarding@resend.dev";

  if (!apiKey || !to) {
    return {
      ok: false,
      error:
        "This form is not set up to receive messages yet. Please try again later.",
    };
  }

  const text = `Merch website quote request\n\nName: ${name}\nEmail: ${email}\n\n${message}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `Merch website quote — ${name}`,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[contact-quote] Resend error", res.status, body);
    return {
      ok: false,
      error: "Could not send your message. Please try again in a moment.",
    };
  }

  return {
    ok: true,
    message: "Thanks — we received your message and will follow up with a quote.",
  };
}
