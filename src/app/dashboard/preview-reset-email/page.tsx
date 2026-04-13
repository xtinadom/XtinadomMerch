import Link from "next/link";
import { notFound } from "next/navigation";
import { emailLinkOrigin } from "@/lib/public-app-url";
import {
  SHOP_PASSWORD_RESET_EMAIL_SUBJECT,
  SHOP_PASSWORD_RESET_PREVIEW_DEMO_TOKEN,
  buildShopPasswordResetEmailHtml,
} from "@/lib/shop-password-reset-email-html";

export const dynamic = "force-dynamic";

/**
 * Browser preview of the password-reset email HTML (does not send mail).
 * Local: always. Production / Vercel Preview: set `ALLOW_EMAIL_PREVIEW=1` only if you need it.
 */
export default function PreviewResetEmailPage() {
  if (process.env.NODE_ENV !== "development" && process.env.ALLOW_EMAIL_PREVIEW !== "1") {
    notFound();
  }

  const demoUrl = `${emailLinkOrigin()}/dashboard/reset-password?t=${encodeURIComponent(SHOP_PASSWORD_RESET_PREVIEW_DEMO_TOKEN)}`;
  const html = buildShopPasswordResetEmailHtml(demoUrl);
  const from =
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM?.trim() ||
    "Xtinadom Merch <onboarding@resend.dev>";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-lg font-semibold text-zinc-100">Password reset email preview</h1>
      <p className="mt-2 text-sm text-zinc-500">
        This page does not send email — it only shows the HTML. Demo link uses your configured{" "}
        <code className="rounded bg-zinc-900 px-1 text-xs">emailLinkOrigin()</code> plus a fake token.
      </p>
      <dl className="mt-6 space-y-3 text-sm">
        <div>
          <dt className="font-medium text-zinc-500">Subject</dt>
          <dd className="mt-0.5 text-zinc-200">{SHOP_PASSWORD_RESET_EMAIL_SUBJECT}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">From (current env)</dt>
          <dd className="mt-0.5 break-all text-zinc-200">{from}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">Demo reset URL</dt>
          <dd className="mt-0.5 break-all font-mono text-xs text-zinc-400">{demoUrl}</dd>
        </div>
      </dl>

      <div className="mt-8 overflow-hidden rounded-lg border border-zinc-600 bg-zinc-100 shadow-xl">
        <p className="border-b border-zinc-300 bg-zinc-200 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
          Email body (as in the message)
        </p>
        <div
          className="px-5 py-6 text-[15px] leading-relaxed text-zinc-900 [&_a]:text-blue-700 [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        <Link href="/dashboard/forgot-password" className="text-blue-400 hover:underline">
          ← Forgot password
        </Link>
      </p>
    </main>
  );
}
