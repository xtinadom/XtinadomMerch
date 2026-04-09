// Pooled vs direct URLs: standard env names, then Vercel/Neon integration suffixes.

function isPostgresUrl(v: string): boolean {
  const t = v.trim();
  return t.startsWith("postgresql://") || t.startsWith("postgres://");
}

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

function isLocalDatabaseHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return false;
  }
}

function tryMigrateDirectCandidate(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t || !isPostgresUrl(t) || isLocalDatabaseHost(t)) return undefined;
  return t;
}

export function migrateDirectUrlFromEnv(): string | undefined {
  const standard =
    tryMigrateDirectCandidate(process.env.PRISMA_MIGRATE_DATABASE_URL) ||
    tryMigrateDirectCandidate(process.env.POSTGRES_URL_NON_POOLING) ||
    tryMigrateDirectCandidate(process.env.DIRECT_URL) ||
    tryMigrateDirectCandidate(process.env.DATABASE_URL_UNPOOLED);
  if (standard) return standard;

  const found: { key: string; url: string }[] = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (!v?.trim() || !isPostgresUrl(v)) continue;
    if (isLocalDatabaseHost(v.trim())) continue;
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
