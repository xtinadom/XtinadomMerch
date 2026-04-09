"use strict";

/**
 * Apply Prisma migrations to production Neon (direct / non-pooling URL).
 *
 * Loads `.env.production.local` (from `vercel env pull --environment production`).
 * Forces `PRISMA_MIGRATE_DATABASE_URL` so a leftover local `DIRECT_URL` in that file
 * cannot send migrations to localhost.
 *
 * Usage: npm run db:migrate:prod
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const envFile = path.join(root, ".env.production.local");

if (!fs.existsSync(envFile)) {
  console.error(
    "[migrate:prod] Missing .env.production.local\n  Run: npx vercel env pull .env.production.local --environment production",
  );
  process.exit(1);
}

require("dotenv").config({ path: envFile });

const neonDirect =
  process.env.PRISMA_MIGRATE_DATABASE_URL?.trim() ||
  process.env.xtmerchneon_POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.xtmerchneon_DATABASE_URL_UNPOOLED?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.DATABASE_URL_UNPOOLED?.trim();

function isLocalHostUrl(u) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return true;
  }
}

let url = neonDirect;
if (!url || isLocalHostUrl(url)) {
  url =
    process.env.xtmerchneon_POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.xtmerchneon_DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    "";
}

if (!url || isLocalHostUrl(url)) {
  console.error(
    "[migrate:prod] No non-local direct Postgres URL found.\n  In .env.production.local set Neon unpooled URL (e.g. xtmerchneon_POSTGRES_URL_NON_POOLING).",
  );
  process.exit(1);
}

console.log("[migrate:prod] Using Neon direct URL for prisma migrate deploy");

const env = { ...process.env, PRISMA_MIGRATE_DATABASE_URL: url };
delete env.DIRECT_URL;
delete env.DATABASE_URL;

const prismaBin = path.join(root, "node_modules", "prisma", "build", "index.js");
const r = spawnSync(process.execPath, [prismaBin, "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
  stdio: "inherit",
  cwd: root,
  env,
});
process.exit(r.status ?? 1);
