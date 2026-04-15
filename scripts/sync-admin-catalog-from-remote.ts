/**
 * Copy `AdminCatalogItem` rows from a remote DB (e.g. production) into the local target DB,
 * remapping `itemPlatformProductId` and per-variant `platformProductId` via `Product.slug`.
 *
 * Target must be local Postgres (localhost / 127.0.0.1) unless ADMIN_CATALOG_SYNC_CONFIRM=1.
 *
 * Typical:
 *   # .env → local DATABASE_URL
 *   # .env.production.local → production URL (or set ADMIN_CATALOG_SYNC_FROM_URL)
 *   npm run db:sync:admin-catalog
 *
 * PowerShell: run `npm` from the repo folder (`cd …\XtinadomMerch`). Paste the real Neon/Vercel URL;
 * use single quotes if it contains `&`: `$env:ADMIN_CATALOG_SYNC_FROM_URL = 'postgresql://…'`
 * (do not use the literal characters `…` — copy the full string from Vercel → Env / Neon dashboard).
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

const root = path.join(__dirname, "..");

function loadTargetUrl(): string | undefined {
  dotenv.config({ path: path.join(root, ".env") });
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_PRISMA_URL?.trim();
}

function postgresUrlFromParsedEnv(parsed: Record<string, string>): string | undefined {
  for (const k of [
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
    "POSTGRES_URL",
    "PRISMA_MIGRATE_DATABASE_URL",
  ]) {
    const v = parsed[k]?.trim();
    if (v && (v.startsWith("postgresql://") || v.startsWith("postgres://"))) return v;
  }
  for (const [k, v] of Object.entries(parsed)) {
    const t = v?.trim();
    if (!t || (!t.startsWith("postgresql://") && !t.startsWith("postgres://"))) continue;
    if (k.endsWith("_POSTGRES_PRISMA_URL") || k.endsWith("_DATABASE_URL")) return t;
  }
  return undefined;
}

function loadSourceUrl(): string | undefined {
  if (process.env.ADMIN_CATALOG_SYNC_FROM_URL?.trim()) {
    return process.env.ADMIN_CATALOG_SYNC_FROM_URL.trim();
  }
  const prodPath = path.join(root, ".env.production.local");
  if (!fs.existsSync(prodPath)) return undefined;
  const parsed = dotenv.parse(fs.readFileSync(prodPath));
  return postgresUrlFromParsedEnv(parsed);
}

function isLocalTargetUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return false;
  }
}

function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    x.search = "";
    return x.toString();
  } catch {
    return u;
  }
}

/** Reject placeholders and malformed URLs before `pg` (avoids opaque getaddrinfo EINVAL). */
function assertValidPostgresUrl(label: string, url: string): void {
  const t = url.trim();
  if (!t.startsWith("postgresql://") && !t.startsWith("postgres://")) {
    console.error(`[sync-admin-catalog] ${label} must start with postgresql:// or postgres://`);
    process.exit(1);
  }
  let host: string;
  try {
    host = new URL(t).hostname;
  } catch {
    console.error(`[sync-admin-catalog] ${label} is not a valid URL (check quotes and special characters).`);
    process.exit(1);
  }
  if (!host || host === "…" || host.includes("\u2026")) {
    console.error(
      `[sync-admin-catalog] ${label} has an invalid hostname "${host}". Paste the real connection string from Vercel or Neon — not an ellipsis placeholder.`,
    );
    process.exit(1);
  }
  if (host.length < 3 || /^\.+$/.test(host)) {
    console.error(`[sync-admin-catalog] ${label} hostname looks wrong: "${host}"`);
    process.exit(1);
  }
}

type AdminRow = {
  sortOrder: number;
  name: string;
  variants: unknown;
  itemPlatformProductId: string | null;
  itemExampleListingUrl: string | null;
  itemMinPriceCents: number;
};

function remapVariantJson(
  variants: unknown,
  sourceProductIdToSlug: Map<string, string>,
  targetSlugToProductId: Map<string, string>,
): unknown {
  if (!Array.isArray(variants)) return [];
  return variants.map((v) => {
    if (!v || typeof v !== "object") return v;
    const o = { ...(v as Record<string, unknown>) };
    const pid = typeof o.platformProductId === "string" ? o.platformProductId.trim() : "";
    if (pid) {
      const slug = sourceProductIdToSlug.get(pid);
      o.platformProductId = slug ? (targetSlugToProductId.get(slug) ?? "") : "";
    }
    return o;
  });
}

async function main() {
  const targetUrl = loadTargetUrl();
  const sourceUrl = loadSourceUrl();

  if (!targetUrl) {
    console.error("[sync-admin-catalog] Missing target DATABASE_URL in .env");
    process.exit(1);
  }
  if (!sourceUrl) {
    console.error(
      "[sync-admin-catalog] Missing source URL. Set ADMIN_CATALOG_SYNC_FROM_URL or add .env.production.local with POSTGRES_PRISMA_URL / DATABASE_URL.",
    );
    process.exit(1);
  }
  if (normalizeUrl(sourceUrl) === normalizeUrl(targetUrl)) {
    console.error("[sync-admin-catalog] Source and target URLs are the same; refusing.");
    process.exit(1);
  }
  if (!isLocalTargetUrl(targetUrl) && process.env.ADMIN_CATALOG_SYNC_CONFIRM !== "1") {
    console.error(
      "[sync-admin-catalog] Target DATABASE_URL is not local (localhost/127.0.0.1). To overwrite a non-local DB, set ADMIN_CATALOG_SYNC_CONFIRM=1.",
    );
    process.exit(1);
  }

  assertValidPostgresUrl("Source (ADMIN_CATALOG_SYNC_FROM_URL or .env.production.local)", sourceUrl);
  assertValidPostgresUrl("Target (.env DATABASE_URL)", targetUrl);

  const sourcePool = new pg.Pool({ connectionString: sourceUrl });
  const targetPool = new pg.Pool({ connectionString: targetUrl });

  try {
    const { rows: sourceProducts } = await sourcePool.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM "Product"`,
    );
    const sourceIdToSlug = new Map(sourceProducts.map((p) => [p.id, p.slug]));

    const { rows: targetProducts } = await targetPool.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM "Product"`,
    );
    const targetSlugToId = new Map(targetProducts.map((p) => [p.slug, p.id]));

    const { rows: sourceItems } = await sourcePool.query<{
      sortOrder: number;
      name: string;
      variants: unknown;
      itemPlatformProductId: string | null;
      itemExampleListingUrl: string | null;
      itemMinPriceCents: number;
    }>(
      `SELECT "sortOrder", name, variants, "itemPlatformProductId", "itemExampleListingUrl", "itemMinPriceCents"
       FROM "AdminCatalogItem"
       ORDER BY "sortOrder" ASC, "createdAt" ASC`,
    );

    if (sourceItems.length === 0) {
      console.log("[sync-admin-catalog] Source has 0 admin catalog rows; leaving target unchanged.");
      return;
    }

    const mapped: AdminRow[] = [];
    for (const row of sourceItems) {
      let itemPlatformProductId: string | null = null;
      if (row.itemPlatformProductId) {
        const slug = sourceIdToSlug.get(row.itemPlatformProductId);
        itemPlatformProductId = slug ? targetSlugToId.get(slug) ?? null : null;
      }
      const variants = remapVariantJson(row.variants, sourceIdToSlug, targetSlugToId);
      mapped.push({
        sortOrder: row.sortOrder,
        name: row.name,
        variants,
        itemPlatformProductId,
        itemExampleListingUrl: row.itemExampleListingUrl,
        itemMinPriceCents: row.itemMinPriceCents,
      });
    }

    const client = await targetPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM "AdminCatalogItem"`);
      const now = new Date().toISOString();
      for (const m of mapped) {
        const id = randomUUID().replace(/-/g, "").slice(0, 25);
        await client.query(
          `INSERT INTO "AdminCatalogItem" (
            id, "sortOrder", name, variants, "itemPlatformProductId", "itemExampleListingUrl", "itemMinPriceCents", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::timestamptz, $9::timestamptz)`,
          [
            id,
            m.sortOrder,
            m.name,
            JSON.stringify(m.variants ?? []),
            m.itemPlatformProductId,
            m.itemExampleListingUrl,
            m.itemMinPriceCents,
            now,
            now,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    console.log(`[sync-admin-catalog] Replaced local AdminCatalogItem with ${mapped.length} row(s) from source.`);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
