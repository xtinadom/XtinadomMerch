/**
 * Verify Cloudflare R2 env vars and upload a 1×1 PNG (then optional HEAD check).
 *
 * Usage (from repo root):
 *   npx tsx scripts/test-r2-upload.ts
 *
 * Loads `.env.local` then `.env` (same idea as Next.js).
 */

import { config } from "dotenv";
import {
  isR2UploadConfigured,
  putPublicR2Object,
  readR2Env,
  readR2BucketName,
} from "../src/lib/r2-upload";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function main() {
  console.log("[r2-test] Checking environment…\n");

  const required = [
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_PUBLIC_BASE_URL",
  ] as const;
  const idOrEndpoint = readR2Env("R2_ACCOUNT_ID")
    ? "R2_ACCOUNT_ID"
    : readR2Env("R2_ENDPOINT")
      ? "R2_ENDPOINT"
      : null;

  for (const k of required) {
    const v = readR2Env(k);
    console.log(`  ${k}: ${v ? "set" : "MISSING"}`);
  }
  {
    const b = readR2BucketName();
    console.log(
      `  R2_BUCKET / R2_BUCKET_NAME: ${b ? "set" : "MISSING"}`,
    );
  }
  console.log(
    `  R2_ACCOUNT_ID / R2_ENDPOINT: ${idOrEndpoint ? `${idOrEndpoint} set` : "MISSING (need one)"}`,
  );

  if (!isR2UploadConfigured()) {
    console.error(
      "\n[r2-test] Configure R2 in .env.local (see .env.example), then run again.\n",
    );
    process.exit(1);
  }

  const key = `listing/test-${Date.now()}.png`;
  console.log(`\n[r2-test] Uploading ${key} (${PNG_1X1.length} bytes)…`);

  try {
    const url = await putPublicR2Object({
      key,
      body: PNG_1X1,
      contentType: "image/png",
    });
    console.log(`[r2-test] OK — public URL:\n  ${url}\n`);

    console.log("[r2-test] Fetching URL (HEAD)…");
    const res = await fetch(url, { method: "HEAD" });
    console.log(`  HTTP ${res.status} ${res.statusText}`);
    if (!res.ok) {
      console.warn(
        "\n[r2-test] Upload succeeded but public URL did not return OK. Check R2_PUBLIC_BASE_URL and bucket public access / custom domain.\n",
      );
      process.exit(2);
    }
    console.log("\n[r2-test] Done.\n");
  } catch (e) {
    console.error("[r2-test] Failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

void main();
