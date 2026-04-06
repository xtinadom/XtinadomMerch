"use strict";

/**
 * Run a Node script with env loaded from the first file that exists:
 * .env.vercel.production → .env.production.local → .env.production → .env
 *
 * Usage: node scripts/with-production-env.cjs path/to/script.js [args...]
 *        node scripts/with-production-env.cjs node_modules/next/dist/bin/next start
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const candidates = [
  ".env.vercel.production",
  ".env.production.local",
  ".env.production",
  ".env",
].map((f) => path.join(root, f));

const envFile = candidates.find((f) => fs.existsSync(f));
if (!envFile) {
  console.error(
    "[preview] No env file found. Expected one of: .env.vercel.production (from `vercel env pull`), .env.production.local, .env.production, .env",
  );
  process.exit(1);
}
console.log("[preview] env:", path.relative(root, envFile));

const rest = process.argv.slice(2);
if (rest.length === 0) {
  console.error(
    "Usage: node scripts/with-production-env.cjs <path> [args...]\n  Example: node scripts/with-production-env.cjs node_modules/next/dist/bin/next start",
  );
  process.exit(1);
}

const r = spawnSync(process.execPath, ["--env-file", envFile, ...rest], {
  stdio: "inherit",
  cwd: root,
});
process.exit(r.status ?? 1);
