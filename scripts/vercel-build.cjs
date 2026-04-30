"use strict";

/**
 * Vercel / CI build: **no database calls** — only Prisma Client generation + Next.js.
 *
 * `prisma migrate deploy` / `db push` during `npm run build` fails often on Vercel (pooler,
 * network, Prisma engine). Apply schema separately (see VERCEL.md).
 *
 * Optional: set RUN_PRISMA_SCHEMA_ON_BUILD=1 to run migrate, then db push on failure.
 */
const { execSync, spawnSync } = require("node:child_process");

function run(cmd) {
  console.log(`[build] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env, shell: true });
}

function runOptionalSchemaSync() {
  if (process.env.RUN_PRISMA_SCHEMA_ON_BUILD !== "1") {
    console.log(
      "[build] DB schema sync skipped (default). After deploy, apply schema once — VERCEL.md § Database schema",
    );
    return;
  }

  process.env.CI = process.env.CI || "true";
  console.log("[build] RUN_PRISMA_SCHEMA_ON_BUILD=1 — prisma migrate deploy");
  let code =
    spawnSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
      stdio: "inherit",
      env: process.env,
      shell: true,
    }).status ?? 1;
  if (code !== 0) {
    console.warn("[build] migrate deploy failed — prisma db push --skip-generate");
    code =
      spawnSync("npx prisma db push --skip-generate --schema prisma/schema.prisma", {
        stdio: "inherit",
        env: process.env,
        shell: true,
      }).status ?? 1;
    if (code !== 0) {
      process.exit(code);
    }
  }
}

run("npx prisma generate --schema prisma/schema.prisma");
runOptionalSchemaSync();

// Next 16 defaults to Turbopack for `next build`; this repo sets `webpack()` in next.config.ts
// (chunk load timeout in dev client bundle). Explicit --webpack is required or the build errors.
run("npx next build --webpack");
