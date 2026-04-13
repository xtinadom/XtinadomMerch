import { createHash, randomBytes } from "node:crypto";

export function newPasswordResetRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
