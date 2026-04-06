import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Bump when `Product` (or other models) change in a way that requires a new client instance in dev. */
const PRISMA_SINGLETON_STAMP = "postgres-adapter-v1";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  prismaSingletonStamp?: string;
};

function runtimeDatabaseUrl(): string | undefined {
  return (
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DIRECT_URL?.trim()
  );
}

function createPrisma(): PrismaClient {
  const connectionString = runtimeDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "No database URL. Set DATABASE_URL or (on Vercel Postgres) POSTGRES_PRISMA_URL. Local: postgresql://postgres:postgres@localhost:5432/xtinadom_merch",
    );
  }
  if (connectionString.startsWith("file:")) {
    throw new Error(
      "This app uses PostgreSQL only. Update DATABASE_URL to a postgresql://… connection string.",
    );
  }

  const poolMaxDefault = process.env.VERCEL === "1" ? 1 : 10;
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX ?? poolMaxDefault),
      /** Avoid hanging forever if Postgres is unreachable (Neon/Vercel network issues). */
      connectionTimeoutMillis: Number(
        process.env.PG_CONNECTION_TIMEOUT_MS ?? 15_000,
      ),
    });
  globalForPrisma.pgPool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prismaSingletonStamp !== PRISMA_SINGLETON_STAMP
) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.pgPool = undefined;
  globalForPrisma.prismaSingletonStamp = PRISMA_SINGLETON_STAMP;
}

/** Real `PrismaClient` instance — do not wrap in `Proxy` (breaks Prisma query engine). */
export const prisma = globalForPrisma.prisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
