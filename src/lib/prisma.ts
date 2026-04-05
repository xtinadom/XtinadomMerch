import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaClient as PrismaClientConstructor } from "@/generated/prisma/client";

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

/**
 * Lazy client: `next build` often loads modules without running DB queries.
 * Eager `createPrisma()` on import breaks builds when env is runtime-only or missing during analysis.
 */
function getPrisma(): PrismaClient {
  if (process.env.NODE_ENV !== "production") {
    if (globalForPrisma.prismaSingletonStamp !== PRISMA_SINGLETON_STAMP) {
      globalForPrisma.prisma = undefined;
      globalForPrisma.pgPool = undefined;
      globalForPrisma.prismaSingletonStamp = PRISMA_SINGLETON_STAMP;
    }
  }

  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

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

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX ?? 10),
    });
  globalForPrisma.pgPool = pool;

  const adapter = new PrismaPg(pool);
  globalForPrisma.prisma = new PrismaClientConstructor({ adapter });
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client as object, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
