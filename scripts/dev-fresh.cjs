/**
 * Remove `.next` before starting dev so stale chunk URLs after branch switches / HMR
 * glitches do not cause ChunkLoadError in the browser.
 */
const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  process.stdout.write("[dev-fresh] Removed .next\n");
}
