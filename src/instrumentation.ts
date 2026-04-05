export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "development") return;

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$connect();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(
      [
        "",
        "[xtinadom] Cannot reach PostgreSQL. Prisma may report this as «Invalid … findMany() invocation» (often with ECONNREFUSED).",
        "  • From repo root: docker compose up -d",
        "  • Or install PostgreSQL locally and set DATABASE_URL in .env",
        "  • If connection still fails on Windows, try 127.0.0.1 instead of localhost in DATABASE_URL",
        "  • Then: npx prisma db push && npm run db:seed",
        `  (${detail})`,
        "",
      ].join("\n"),
    );
  }
}
