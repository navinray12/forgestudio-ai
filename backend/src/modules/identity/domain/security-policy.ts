import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "../../../utils/app-error.js";
import type { IdentityUser, LoginChallenge } from "../../../platform/ports/identity-store.port.js";

export const CHALLENGE_TTL_MS = 10 * 60_000;
export const SESSION_TTL_MS = 8 * 60 * 60_000;
export const CODE_ATTEMPTS = 5;
export const RESEND_INTERVAL_MS = 60_000;
export const opaqueToken = () => randomBytes(32).toString("base64url");
export const digest = (text: string) => createHash("sha256").update(text).digest("hex");
export const proofDigest = (secret: string, value: string) =>
  createHmac("sha256", secret).update(value).digest("hex");
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function requireUsableUser(user: IdentityUser | null): asserts user is IdentityUser {
  if (!user || user.status !== "ACTIVE") throw invalidAuthentication();
}
export function invalidAuthentication() {
  return new AppError("Authentication could not be completed. Start sign-in again.", 401, "INVALID_AUTHENTICATION");
}
export function requireChallenge(challenge: LoginChallenge | null, user: IdentityUser, now: Date, kind: string) {
  if (!challenge || challenge.userId !== user.id || challenge.kind !== kind ||
      challenge.authEpoch !== user.authEpoch || challenge.expiresAt <= now ||
      ["CONSUMED", "FAILED"].includes(challenge.status)) throw invalidAuthentication();
}
export function publicUser(user: IdentityUser) {
  const { id, email, phone, fullName, role, status, emailVerified, phoneVerified } = user;
  return { id, email, phone, fullName, role, status, emailVerified, phoneVerified };
}
