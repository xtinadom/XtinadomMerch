"use strict";

try {
  require("dotenv/config");
} catch {
  /* optional */
}

/**
 * prisma generate → sync schema → next build (webpack on Vercel)
 *
 * Vercel Postgres / Neon: without POSTGRES_URL_NON_POOLING or DIRECT_URL,
 * `migrate deploy` almost always fails on pooled URLs. On Vercel we then
 * use `prisma db push` only (schema still matches prisma/schema.prisma).
 */
const { execSync, spawnSync } = require("node:child_process");

function normalizeVercelDatabaseEnv() {
  if (process.env.VERCEL !== "1") return;
  const prismaUrl = process.env.POSTGRES_PRISMA_URL?.trim();
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl && prismaUrl) {
    process.env.DATABASE_URL = prismaUrl;
    console.log(
      "[build] DATABASE_URL was empty — copied POSTGRES_PRISMA_URL for Prisma CLI",
    );
  }
}

const DB_ENV_KEYS = [
  "PRISMA_MIGRATE_DATABASE_URL",
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
    present.length ? present.join(", ") : "(none)",
  );
}

function hasDirectMigrateUrl() {
  return !!(
    process.env.PRISMA_MIGRATE_DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim()
  );
}

function runShell(cmd) {
  console.log(`[build] ${cmd}`);
  const r = spawnSync(cmd, {
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
  return r.status === null ? 1 : r.status;
}

function hasAnyPostgresUrl() {
  return DB_ENV_KEYS.some((k) => process.env[k]?.trim());
}

function syncDatabaseSchema() {
  if (process.env.SKIP_PRISMA_SCHEMA_SYNC === "1") {
    console.warn(
      "[build] SKIP_PRISMA_SCHEMA_SYNC=1 — skipping migrate deploy / db push",
    );
    return;
  }

  if (!hasAnyPostgresUrl()) {
    console.warn(
      "[build] WARN: No Postgres URL in env — skipping db push / migrate. Add POSTGRES_PRISMA_URL or DATABASE_URL for **Production** (and Preview if needed), then redeploy.",
    );
    return;
  }

  process.env.CI = process.env.CI || "true";

  const onVercel = process.env.VERCEL === "1";
  const strict = process.env.STRICT_PRISMA_MIGRATE === "1";
  const direct = hasDirectMigrateUrl();

  if (onVercel && !direct) {
    console.log(
      "[build] Vercel without direct Postgres URL — using prisma db push (not migrate deploy). " +
        "Optional: add POSTGRES_URL_NON_POOLING or DIRECT_URL to use migrations.",
    );
    const pushExit = runShell("npx prisma db push --skip-generate");
    if (pushExit !== 0) {
      process.exit(pushExit);
    }
    return;
  }

  const migrateExit = runShell("npx prisma migrate deploy");
  if (migrateExit === 0) {
    return;
  }

  if (!onVercel || strict) {
    console.error(
      "\n[build] prisma migrate deploy failed. Use a direct DB URL for migrations or (on Vercel) omit direct URL to use db push only.\n",
    );
    process.exit(migrateExit);
  }

  console.warn(
    "\n[build] prisma migrate deploy failed — falling back to prisma db push.\n",
  );
  const pushExit = runShell("npx prisma db push --skip-generate");
  if (pushExit !== 0) {
    process.exit(pushExit);
  }
}

function run(cmd) {
  console.log(`[build] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env, shell: true });
}

normalizeVercelDatabaseEnv();
logDbEnv();

run("npx prisma generate");
syncDatabaseSchema();

const nextCmd =
  process.env.VERCEL === "1"
    ? "npx next build --webpack"
    : "npx next build";
run(nextCmd);
