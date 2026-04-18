import fs from "node:fs/promises";
import path from "node:path";

/**
 * Total byte size of all regular files under `dir` (recursive). Symlinked directories are not followed.
 * Returns null if `dir` is missing or not a directory.
 */
export async function getDirectoryTotalSizeBytes(dir: string): Promise<number | null> {
  let st;
  try {
    st = await fs.stat(dir);
  } catch {
    return null;
  }
  if (!st.isDirectory()) return null;

  let total = 0;
  const pending: string[] = [dir];
  while (pending.length) {
    const current = pending.pop()!;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      try {
        if (ent.isDirectory()) {
          pending.push(full);
        } else if (ent.isFile()) {
          const f = await fs.stat(full);
          total += f.size;
        } else if (ent.isSymbolicLink()) {
          const f = await fs.stat(full);
          if (f.isFile()) total += f.size;
        }
      } catch {
        continue;
      }
    }
  }
  return total;
}

export function formatBytesForAdmin(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let n = bytes;
  let u = -1;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  const decimals = u < 0 ? 0 : n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return `${n.toFixed(decimals)} ${units[u]}`;
}

export type AdminDeployFootprint = {
  /** Sum of file sizes under `.next` at `process.cwd()`, if that folder exists. */
  nextBuildBytes: number | null;
  nextBuildDirPresent: boolean;
  processCwd: string;
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
  isVercel: boolean;
};

/**
 * Footprint of the compiled Next.js app on the host serving the request (typically production build output).
 * Does not include `node_modules` or git history.
 */
export async function getAdminDeployFootprint(): Promise<AdminDeployFootprint> {
  const processCwd = process.cwd();
  const nextDir = path.join(processCwd, ".next");
  let nextBuildDirPresent = false;
  try {
    const st = await fs.stat(nextDir);
    nextBuildDirPresent = st.isDirectory();
  } catch {
    nextBuildDirPresent = false;
  }

  const nextBuildBytes = nextBuildDirPresent
    ? await getDirectoryTotalSizeBytes(nextDir)
    : null;

  return {
    nextBuildBytes,
    nextBuildDirPresent,
    processCwd,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    isVercel: Boolean(process.env.VERCEL),
  };
}
