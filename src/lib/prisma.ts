import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { runtimeDatabaseUrlFromEnv } from "@/lib/env-postgres-url";

/**
 * Bump when the Prisma schema (or generated client shape) changes so the cached `globalThis` client
 * is dropped — otherwise delegates like `adminCatalogItem` are missing (`findMany` of undefined) or
 * you get unknown-field validation errors. After `npx prisma generate`, bump this and restart dev
 * (or delete `.next`) if needed.
 */
const PRISMA_SINGLETON_STAMP = "postgres-adapter-v27-admin-goods-services-cost";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  prismaSingletonStamp?: string;
};

function createPrisma(): PrismaClient {
  const connectionString = runtimeDatabaseUrlFromEnv();
  if (!connectionString) {
    throw new Error(
      "No database URL. Set DATABASE_URL or POSTGRES_PRISMA_URL. Local: npm run db:up then use postgresql://postgres:postgres@127.0.0.1:5432/xtinadom_merch",
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

if (globalForPrisma.prismaSingletonStamp !== PRISMA_SINGLETON_STAMP) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.pgPool = undefined;
  globalForPrisma.prismaSingletonStamp = PRISMA_SINGLETON_STAMP;
}

/** Real `PrismaClient` instance — do not wrap in `Proxy` (breaks Prisma query engine). */
export const prisma = globalForPrisma.prisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
