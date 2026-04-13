import { runtimeDatabaseUrlFromEnv } from "@/lib/env-postgres-url";

export const runtime = "nodejs";

/** Lightweight liveness check (no DB query). */
export async function GET() {
  const hasDatabaseUrl = Boolean(runtimeDatabaseUrlFromEnv());
  return Response.json(
    { ok: true, hasDatabaseUrl },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
