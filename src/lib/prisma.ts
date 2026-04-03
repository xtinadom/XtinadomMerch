import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/** Bump when `Product` (or other models) change in a way that requires a new client instance in dev. */
const PRISMA_SINGLETON_STAMP = "product-printifyVariants-json-v1";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSingletonStamp?: string;
};

/** Resolve DATABASE_URL (file:...) to a form the SQLite adapter accepts. */
function sqliteUrlForAdapter(): string {
  const fromEnv = process.env.DATABASE_URL;
  const defaultPath = path.join(process.cwd(), "prisma", "dev.db");
  const raw = fromEnv?.trim() || `file:${defaultPath}`;

  if (raw.startsWith("postgres")) {
    throw new Error(
      "DATABASE_URL points to PostgreSQL but this app uses SQLite locally. Set DATABASE_URL=file:./prisma/dev.db",
    );
  }

  if (raw.startsWith("file:")) {
    const withoutScheme = raw.slice("file:".length).replace(/^\/+/, "");
    const absolute = path.isAbsolute(withoutScheme)
      ? withoutScheme
      : path.join(process.cwd(), withoutScheme);
    return `file:${absolute}`;
  }

  return `file:${path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw)}`;
}

function createPrisma() {
  const adapter = new PrismaBetterSqlite3({
    url: sqliteUrlForAdapter(),
  });
  return new PrismaClient({ adapter });
}

if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prismaSingletonStamp !== PRISMA_SINGLETON_STAMP
) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaSingletonStamp = PRISMA_SINGLETON_STAMP;
}

export const prisma = globalForPrisma.prisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
