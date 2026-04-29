import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaClient as PrismaClientConstructor } from "@/generated/prisma/client";
import { runtimeDatabaseUrlFromEnv } from "@/lib/env-postgres-url";

export type PrismaAdminInboundEmailDelegate = PrismaClient["adminInboundEmail"];

/**
 * Bump when the Prisma schema (or generated client shape) changes so the cached `globalThis` client
 * is dropped — otherwise delegates like `adminCatalogItem` are missing (`findMany` of undefined) or
 * you get unknown-field validation errors. After `npx prisma generate`, bump this and restart dev
 * (or delete `.next`) if needed.
 */
const PRISMA_SINGLETON_STAMP =
  "postgres-adapter-v44-promotion-eligible-from";

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
  return new PrismaClientConstructor({ adapter });
}

if (globalForPrisma.prismaSingletonStamp !== PRISMA_SINGLETON_STAMP) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.pgPool = undefined;
  globalForPrisma.prismaSingletonStamp = PRISMA_SINGLETON_STAMP;
}

function clientHasPromotionPurchaseDelegate(client: PrismaClient): boolean {
  return (
    typeof (client as { promotionPurchase?: { findMany?: unknown } }).promotionPurchase
      ?.findMany === "function"
  );
}

/**
 * Drops and recreates the Prisma singleton when `promotionPurchase` is missing (stale codegen / dev HMR).
 * Also updates the exported {@link prisma} binding — must not use `export const prisma` or importers keep
 * a stale object reference forever.
 */
function reconcilePrismaSingleton(): PrismaClient {
  let client = globalForPrisma.prisma ?? createPrisma();

  if (!clientHasPromotionPurchaseDelegate(client)) {
    globalForPrisma.prisma = undefined;
    client = createPrisma();
    if (!clientHasPromotionPurchaseDelegate(client)) {
      throw new Error(
        "PrismaClient is missing the promotionPurchase delegate. Run `npx prisma generate`, ensure src/generated/prisma is up to date, and restart the server.",
      );
    }
  }

  globalForPrisma.prisma = client;
  return client;
}

/**
 * Real `PrismaClient` instance — do not wrap in `Proxy` (breaks Prisma query engine).
 * `let`: {@link reconcilePrismaSingleton} may replace the instance; `export const` would freeze stale refs.
 */
export let prisma: PrismaClient = reconcilePrismaSingleton();

/**
 * Re-run reconciliation and sync {@link prisma} (call after codegen hot-reloads in rare dev cases).
 */
export function reconcilePrismaAndSyncExport(): PrismaClient {
  const next = reconcilePrismaSingleton();
  prisma = next;
  return next;
}

/**
 * `AdminInboundEmail` was added after some deploys; a long-lived Node process can still hold an older
 * `PrismaClient` without this delegate. Use this helper instead of `prisma.adminInboundEmail` when the
 * process might predate `PRISMA_SINGLETON_STAMP` bumps.
 */
export function prismaAdminInboundEmailOrNull(): PrismaAdminInboundEmailDelegate | null {
  const delegate = (prisma as PrismaClient & { adminInboundEmail?: PrismaAdminInboundEmailDelegate })
    .adminInboundEmail;
  return delegate ?? null;
}
