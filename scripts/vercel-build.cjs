"use strict";

try {
  require("dotenv/config");
} catch {
  /* optional */
}

/**
 * prisma generate → migrate deploy → next build
 * On Vercel, uses `next build --webpack` (more reliable than Turbopack for some Prisma/pg setups).
 */
const { execSync } = require("node:child_process");

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

function warnIfLikelyMisconfig() {
  if (process.env.VERCEL !== "1") return;

  const hasAny = DB_ENV_KEYS.some((k) => process.env[k]?.trim());
  if (!hasAny) {
    console.warn(
      "[build] WARN: No Postgres env vars detected. Add DATABASE_URL (and for Neon, DIRECT_URL or PRISMA_MIGRATE_DATABASE_URL for migrations). Ensure variables are enabled for **Build** on Vercel.",
    );
    return;
  }

  const hasDirect =
    process.env.PRISMA_MIGRATE_DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim();

  if (process.env.POSTGRES_PRISMA_URL?.trim() && !hasDirect) {
    console.warn(
      "[build] WARN: POSTGRES_PRISMA_URL without a direct migrate URL — if migrate deploy fails, add POSTGRES_URL_NON_POOLING or PRISMA_MIGRATE_DATABASE_URL.",
    );
  }
}

function run(cmd) {
  console.log(`[build] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env, shell: true });
}

logDbEnv();
warnIfLikelyMisconfig();

run("npx prisma generate");
run("npx prisma migrate deploy");

const nextCmd =
  process.env.VERCEL === "1"
    ? "npx next build --webpack"
    : "npx next build";
run(nextCmd);
