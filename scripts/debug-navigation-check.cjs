"use strict";

/**
 * Automates parts of the repo "debug stuck navigation" checklist:
 * - Phase 1–2: HTTP GET / /shops /shop/all on 127.0.0.1:3000 and :3001 (same idea as curl).
 * - Phase 3 (partial): whether common env keys are set (no secret values printed).
 *
 * Usage: `npm run debug:routes` with `npm run dev` running in another terminal.
 */

const http = require("node:http");

try {
  require("dotenv").config({ path: ".env.development.local" });
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config({ path: ".env" });
} catch {
  /* dotenv optional */
}

function envHints() {
  console.log("\n--- Phase 3 env hints (booleans only, never secret values) ---");
  console.log(
    "DATABASE_URL set:",
    Boolean(process.env.DATABASE_URL?.trim() || process.env.POSTGRES_PRISMA_URL?.trim()),
  );
  console.log("DEMO_MODE:", process.env.DEMO_MODE === "1");
  console.log("MOCK_CHECKOUT:", process.env.MOCK_CHECKOUT === "1");
  console.log(
    "SITE_ACCESS_PASSWORD set:",
    Boolean(process.env.SITE_ACCESS_PASSWORD?.trim()),
  );
  console.log("SITE_ACCESS_SECRET set:", Boolean(process.env.SITE_ACCESS_SECRET?.trim()));
  console.log(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set:",
    Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()),
  );
  console.log(
    "STRIPE_SECRET_KEY set:",
    Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  );
  console.log(
    "NEXT_PUBLIC_APP_URL set:",
    Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
  );
  console.log(
    "\nTip: match browser URL port to the terminal line from `npm run dev` (3000 vs 3001).\n",
  );
}

function request(port, path, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "GET",
        timeout: timeoutMs,
        headers: { Accept: "text/html,application/xhtml+xml" },
      },
      (res) => {
        res.resume();
        resolve({
          port,
          path,
          status: res.statusCode,
          ms: Date.now() - start,
          ok: true,
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({
        port,
        path,
        status: null,
        ms: Date.now() - start,
        ok: false,
        error: "timeout",
      });
    });
    req.on("error", (e) => {
      resolve({
        port,
        path,
        status: null,
        ms: Date.now() - start,
        ok: false,
        error: e.code || e.message,
      });
    });
    req.end();
  });
}

async function main() {
  console.log("debug-navigation-check (Phase 1–2: server responds without browser)\n");
  const ports = [3000, 3001];
  const paths = ["/", "/shops", "/shop/all"];
  const timeoutMs = 30_000;

  for (const port of ports) {
    for (const path of paths) {
      const r = await request(port, path, timeoutMs);
      const line = r.ok
        ? `OK   ${port} ${path} -> HTTP ${r.status} in ${r.ms}ms`
        : `FAIL ${port} ${path} -> ${r.error ?? "unknown"} (${r.ms}ms)`;
      console.log(line);
    }
  }

  envHints();

  console.log("--- Manual Phase 1 ---");
  console.log(
    "Open DevTools → Network; click an internal link; confirm document/RSC fetch completes or stays pending.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
