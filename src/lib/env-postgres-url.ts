/**
 * Resolve Postgres URLs from Vercel env. Standard names first; then Neon (and
 * similar) integration vars like `prefix_POSTGRES_PRISMA_URL` when the
 * unprefixed names are unset.
 */

function isPostgresUrl(v: string): boolean {
  const t = v.trim();
  return t.startsWith("postgresql://") || t.startsWith("postgres://");
}

/** Pooled URL for Prisma Client / `pg` (runtime). */
export function runtimeDatabaseUrlFromEnv(): string | undefined {
  const standard =
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DIRECT_URL?.trim();
  if (standard && isPostgresUrl(standard)) return standard;

  return integrationPooledUrl();
}

const SUFFIX_PRISMA = "_POSTGRES_PRISMA_URL";
const SUFFIX_DB = "_DATABASE_URL";

function integrationPooledUrl(): string | undefined {
  const found: { key: string; url: string }[] = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (!v?.trim() || !isPostgresUrl(v)) continue;
    if (
      (k.length > SUFFIX_PRISMA.length && k.endsWith(SUFFIX_PRISMA)) ||
      (k.length > SUFFIX_DB.length && k.endsWith(SUFFIX_DB))
    ) {
      found.push({ key: k, url: v.trim() });
    }
  }
  if (found.length === 0) return undefined;
  found.sort((a, b) => a.key.localeCompare(b.key));
  if (found.length > 1 && process.env.NODE_ENV === "development") {
    console.warn(
      `[prisma] Multiple integration pooled URLs (${found.map((f) => f.key).join(", ")}). Using ${found[0].key}.`,
    );
  }
  return found[0].url;
}

const SUFFIX_NON_POOLING = "_POSTGRES_URL_NON_POOLING";
const SUFFIX_UNPOOLED = "_DATABASE_URL_UNPOOLED";

/** Direct / non-pooling URL for `prisma migrate` (see prisma.config.ts). */
export function migrateDirectUrlFromEnv(): string | undefined {
  const direct =
    process.env.PRISMA_MIGRATE_DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim();
  if (direct && isPostgresUrl(direct)) return direct;

  const found: { key: string; url: string }[] = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (!v?.trim() || !isPostgresUrl(v)) continue;
    if (
      (k.length > SUFFIX_NON_POOLING.length && k.endsWith(SUFFIX_NON_POOLING)) ||
      (k.length > SUFFIX_UNPOOLED.length && k.endsWith(SUFFIX_UNPOOLED))
    ) {
      found.push({ key: k, url: v.trim() });
    }
  }
  if (found.length === 0) return undefined;
  found.sort((a, b) => a.key.localeCompare(b.key));
  if (found.length > 1 && process.env.NODE_ENV === "development") {
    console.warn(
      `[prisma] Multiple integration direct URLs (${found.map((f) => f.key).join(", ")}). Using ${found[0].key}.`,
    );
  }
  return found[0].url;
}
