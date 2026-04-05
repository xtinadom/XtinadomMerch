"use strict";

try {
  require("dotenv/config");
} catch {
  /* optional — prisma CLI also loads .env via prisma.config.ts */
}

/**
 * Vercel / CI build: prisma generate → migrate deploy → next build.
 * Logs which DB-related env keys are set (names only) to debug missing Build env vars.
 */
const { execSync } = require("node:child_process");

const DB_ENV_KEYS = [
  "POSTGRES_URL_NON_POOLING",
  "DIRECT_URL",
  "DATABASE_URL_UNPOOLED",
  "DATABASE_URL",
  "POSTGRES_URL",
  "PRISMA_DATABASE_URL",
  "POSTGRES_PRISMA_URL",
];

function logDbEnv() {
  const present = DB_ENV_KEYS.filter((k) => process.env[k]?.trim());
  console.log(
    "[build] Database env keys with values:",
    present.length ? present.join(", ") : "(none — migrate will fail on Vercel)",
  );
}

function migrateUrlForDiagnostics() {
  return (
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.PRISMA_DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    ""
  );
}

function looksLikePooledOnlyMigrations() {
  const hasDirect =
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim();
  if (hasDirect) return false;
  const u = migrateUrlForDiagnostics();
  if (!u) return false;
  try {
    const normalized = u.replace(/^postgresql:/i, "http:");
    const { hostname, search } = new URL(normalized);
    const h = hostname.toLowerCase();
    if (h.includes("pooler") || h.includes("-pooler")) return true;
    if (search.includes("pgbouncer=true")) return true;
    return false;
  } catch {
    return false;
  }
}

function run(cmd) {
  console.log(`[build] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env, shell: true });
}

logDbEnv();

if (process.env.VERCEL === "1" && !migrateUrlForDiagnostics()) {
  console.error(`
[build] ERROR: No Postgres URL available during this build.
On Vercel → Project → Settings → Environment Variables:
  • Add DATABASE_URL (or use Vercel Postgres: POSTGRES_PRISMA_URL + POSTGRES_URL_NON_POOLING).
  • Open each variable → ensure it applies to **Production** (or Preview) **and** that
    "Sensitive" / build exposure allows it to be available at **Build** time, not only Runtime.
`);
  process.exit(1);
}

const hasDirectMigrateUrl =
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL_UNPOOLED?.trim();

if (
  process.env.VERCEL === "1" &&
  process.env.POSTGRES_PRISMA_URL?.trim() &&
  !hasDirectMigrateUrl
) {
  console.error(`
[build] ERROR: POSTGRES_PRISMA_URL is set but no direct URL for migrations.
Add POSTGRES_URL_NON_POOLING (Vercel Postgres) or DIRECT_URL / DATABASE_URL_UNPOOLED (Neon).
`);
  process.exit(1);
}

if (looksLikePooledOnlyMigrations()) {
  console.error(`
[build] ERROR: Only a pooled Postgres URL is configured. prisma migrate deploy needs a direct connection.

Fix:
  • Neon: add DIRECT_URL (non-pooled) from the Neon dashboard, and keep DATABASE_URL pooled.
  • Vercel Postgres: add POSTGRES_URL_NON_POOLING (Vercel sets this when you connect Storage).
`);
  process.exit(1);
}

run("npx prisma generate");
run("npx prisma migrate deploy");
run("npx next build");
