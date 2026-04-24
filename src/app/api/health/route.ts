import { runtimeDatabaseUrlFromEnv } from "@/lib/env-postgres-url";
import { emailLinkOrigin } from "@/lib/public-app-url";

export const runtime = "nodejs";

/**
 * Liveness + quick config hints (no secrets). Use after deploy to confirm password-reset env.
 */
export async function GET() {
  const hasDatabaseUrl = Boolean(runtimeDatabaseUrlFromEnv());
  const hasResendApiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasShopPasswordResetFrom = Boolean(process.env.SHOP_PASSWORD_RESET_EMAIL_FROM?.trim());
  const hasShopAccountDeletionFrom = Boolean(process.env.SHOP_ACCOUNT_DELETION_EMAIL_FROM?.trim());
  const hasVerifiedTransactionalFrom =
    hasShopPasswordResetFrom || hasShopAccountDeletionFrom || Boolean(process.env.SHOP_EMAIL_VERIFICATION_EMAIL_FROM?.trim());
  const passwordResetLinkOrigin = emailLinkOrigin();
  return Response.json(
    {
      ok: true,
      hasDatabaseUrl,
      passwordReset: {
        hasResendApiKey,
        hasShopPasswordResetFrom,
        /** Base URL used inside reset links in email (check matches your live site). */
        linkOrigin: passwordResetLinkOrigin,
      },
      accountDeletionEmail: {
        hasResendApiKey,
        hasShopAccountDeletionFrom,
        /** Uses verified From if any shop transactional From is set; otherwise `onboarding@resend.dev` (smoke tests only). */
        hasVerifiedTransactionalFrom,
        linkOrigin: passwordResetLinkOrigin,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
