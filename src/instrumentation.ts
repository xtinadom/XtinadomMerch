export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.NODE_ENV === "development") {
    try {
      // Avoid bundling `pg` into the instrumentation chunk (webpack `--webpack` / Vercel).
      const { prisma } = await import(
        /* webpackIgnore: true */
        "./lib/prisma"
      );
      await prisma.$connect();
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error(
        [
          "",
          "[xtinadom] Cannot reach PostgreSQL. Prisma may report this as «Invalid … findMany() invocation» (often with ECONNREFUSED).",
          "  • From repo root: npm run db:up   (or: docker compose up -d)",
          "  • Or install PostgreSQL locally and set DATABASE_URL in .env",
          "  • If connection still fails on Windows, use 127.0.0.1 instead of localhost in DATABASE_URL",
          "  • Then: npx prisma db push && npm run db:seed",
          `  (${detail})`,
          "",
        ].join("\n"),
      );
    }
    return;
  }

  const { runtimeDatabaseUrlFromEnv } = await import("./lib/env-postgres-url");
  const dbUrl = runtimeDatabaseUrlFromEnv();
  if (!dbUrl) {
    console.error(
      "[xtinadom] No DATABASE_URL or POSTGRES_PRISMA_URL — shop and admin need Postgres. Set env on Vercel and redeploy. See VERCEL.md §5.",
    );
  }

  const gatePwd = process.env.SITE_ACCESS_PASSWORD?.trim();
  const gateSecret = process.env.SITE_ACCESS_SECRET?.trim();
  if (!gatePwd || !gateSecret) {
    console.warn(
      "[xtinadom] Site password gate is off — set both SITE_ACCESS_PASSWORD and SITE_ACCESS_SECRET to require /gate before browsing.",
    );
  }
}
