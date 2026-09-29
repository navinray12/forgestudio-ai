import { randomInt, randomUUID } from "node:crypto";
import type { IdentityDeliveryPort, PasswordPort } from "../../../platform/ports/identity-delivery.port.js";
import type { IdentityStorePort, LoginChallenge } from "../../../platform/ports/identity-store.port.js";
import { AppError } from "../../../utils/app-error.js";
import { CHALLENGE_TTL_MS, SESSION_TTL_MS, CODE_ATTEMPTS, RESEND_INTERVAL_MS, digest,
  opaqueToken, proofDigest, safeEqual, requireUsableUser, requireChallenge, invalidAuthentication, publicUser } from "../domain/security-policy.js";

type Purpose = "LOGIN" | "SIGNUP";
export class LocalAuthentication {
  private passwordWork = 0;
  private dummyHash: Promise<string> | undefined;
  constructor(
    private readonly store: IdentityStorePort,
    private readonly passwords: PasswordPort,
    private readonly delivery: IdentityDeliveryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async rateLimit(scope: string, subject: string, maximum: number) {
    const now = this.now();
    const start = new Date(Math.floor(now.getTime() / 900_000) * 900_000);
    const count = await this.store.consumeRateBucket(digest(`${scope}:${subject}`), start, new Date(start.getTime() + 900_000));
    if (count > maximum) throw new AppError("Too many authentication attempts. Try again later.", 429, "AUTH_RATE_LIMITED");
  }
  private async passwordTask<T>(task: () => Promise<T>) {
    if (this.passwordWork >= 4) throw new AppError("Sign-in is busy. Try again shortly.", 503, "AUTH_CAPACITY");
    this.passwordWork++;
    try { return await task(); } finally { this.passwordWork--; }
  }
  private challenge(userId: string, email: string, epoch: number, kind: Purpose) {
    const secret = opaqueToken(); const now = this.now();
    const challenge: LoginChallenge = { id: randomUUID(), userId, email, authEpoch: epoch, kind,
      secretHash: digest(secret), status: "PENDING", otpHash: null, attempts: 0,
      expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS), lastSentAt: null, createdAt: now,
      providerKey: null, initiatingSessionId: null };
    return { secret, challenge };
  }
  async beginLogin(email: string, password: string, ip: string) {
    await this.rateLimit("password-ip", ip, 30);
    await this.rateLimit("password-account", email, 10);
    const found = await this.store.findUserByEmail(email);
    const valid = await this.passwordTask(async () => {
      this.dummyHash ??= this.passwords.hash(opaqueToken());
      const hash = found?.passwordHash ?? await this.dummyHash;
      try { return await this.passwords.verify(password, hash); } catch { return false; }
    });
    if (!valid || !found?.email || !found.passwordHash) throw invalidAuthentication();
    const pending = this.challenge(found.id, found.email, found.authEpoch, "LOGIN");
    const user = await this.store.transaction(async tx => {
      const current = await tx.lockUser(found.id); requireUsableUser(current);
      if (current.authEpoch !== found.authEpoch || current.passwordHash !== found.passwordHash) throw invalidAuthentication();
      await tx.closeChallenges(current.id, "LOGIN");
      await tx.createChallenge(pending.challenge);
      return publicUser(current);
    });
    return { secret: pending.secret, user };
  }
  async beginSignup(email: string, fullName: string, password: string, ip: string) {
    await this.rateLimit("signup-ip", ip, 10);
    await this.rateLimit("signup-account", email, 5);
    if (await this.store.findUserByEmail(email)) {
      throw new AppError("Unable to create this account. Use sign-in or account recovery.", 409, "ACCOUNT_EXISTS");
    }
    const hash = await this.passwordTask(() => this.passwords.hash(password));
    const pending = this.challenge(randomUUID(), email, 1, "SIGNUP");
    const user = await this.store.transaction(async tx => {
      const created = await tx.createUser({ id: pending.challenge.userId!, email, fullName, passwordHash: hash });
      await tx.createChallenge(pending.challenge);
      await tx.audit(created.id, "IDENTITY_ACCOUNT_CREATED", `user:${created.id}`);
      return publicUser(created);
    });
    return { secret: pending.secret, user };
  }
  private async lookup(secret: unknown, userId: string, purpose: Purpose) {
    if (typeof secret !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(secret)) throw invalidAuthentication();
    const row = await this.store.findChallenge(digest(secret));
    if (!row || row.kind !== purpose || row.userId !== userId) throw invalidAuthentication();
    return { secret, row };
  }
  async sendCode(secretInput: unknown, userId: string, purpose: Purpose) {
    const { secret, row } = await this.lookup(secretInput, userId, purpose);
    const code = randomInt(100000, 1000000).toString();
    const codeHash = proofDigest(secret, `${row.id}:${code}`);
    const email = await this.store.transaction(async tx => {
      const user = await tx.lockUser(userId); requireUsableUser(user);
      const current = await tx.lockChallenge(row.id);
      requireChallenge(current, user, this.now(), purpose);
      if (current!.status === "DELIVERING" || current!.attempts >= CODE_ATTEMPTS) throw invalidAuthentication();
      const last = await tx.lastDelivery(userId);
      if (last && this.now().getTime() - last.getTime() < RESEND_INTERVAL_MS) {
        throw new AppError("Wait before requesting another code.", 429, "OTP_RESEND_COOLDOWN");
      }
      if (!user.email || user.email !== current!.email) throw invalidAuthentication();
      // Reserve delivery under the actor lock. Network I/O is outside the transaction.
      await tx.updateChallenge(row.id, { status: "DELIVERING", otpHash: codeHash, lastSentAt: this.now() });
      return user.email;
    });
    try {
      await this.delivery.sendCode({ email, code, purpose });
    } catch {
      await this.store.transaction(async tx => {
        await tx.lockUser(userId);
        const current = await tx.lockChallenge(row.id);
        if (current?.otpHash === codeHash && current.status === "DELIVERING") {
          await tx.updateChallenge(row.id, { status: "FAILED", otpHash: null });
        }
        await tx.audit(userId, "IDENTITY_DELIVERY_FAILED", `challenge:${row.id}`);
      });
      throw new AppError("Verification delivery is unavailable. Start sign-in again later.", 503, "IDENTITY_DELIVERY_UNAVAILABLE");
    }
    await this.store.transaction(async tx => {
      const user = await tx.lockUser(userId); requireUsableUser(user);
      const current = await tx.lockChallenge(row.id);
      requireChallenge(current, user, this.now(), purpose);
      if (current!.otpHash !== codeHash || current!.status !== "DELIVERING") throw invalidAuthentication();
      await tx.updateChallenge(row.id, { status: "READY" });
      await tx.audit(userId, "IDENTITY_CODE_ACCEPTED_BY_PROVIDER", `challenge:${row.id}`);
    });
  }
  async finish(secretInput: unknown, userId: string, purpose: Purpose, code: string) {
    const { secret, row } = await this.lookup(secretInput, userId, purpose);
    const token = opaqueToken(); const now = this.now(); const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const result = await this.store.transaction(async tx => {
      const user = await tx.lockUser(userId); requireUsableUser(user);
      const current = await tx.lockChallenge(row.id);
      requireChallenge(current, user, now, purpose);
      if (current!.status !== "READY" || !current!.otpHash || current!.attempts >= CODE_ATTEMPTS ||
          user.email !== current!.email) throw invalidAuthentication();
      const valid = /^\d{6}$/.test(code) && safeEqual(current!.otpHash, proofDigest(secret, `${row.id}:${code}`));
      if (!valid) {
        const attempts = current!.attempts + 1;
        await tx.updateChallenge(row.id, { attempts, ...(attempts >= CODE_ATTEMPTS ? { status: "FAILED", otpHash: null } : {}) });
        await tx.audit(userId, "IDENTITY_CODE_REJECTED", `challenge:${row.id}`, { attempts });
        return null; // Commit attempt accounting; throwing here would undo the security limit.
      }
      await tx.updateChallenge(row.id, { status: "CONSUMED", otpHash: null });
      const verified = await tx.markEmailVerified(userId);
      await tx.createSession({ userId, tokenHash: digest(token), expiresAt, authEpoch: user.authEpoch,
        authMethod: "local", authTime: now, assurance: "email-otp", mfaVerifiedAt: null });
      await tx.audit(userId, "IDENTITY_LOGIN_COMPLETED", `challenge:${row.id}`, { method: "local" });
      return publicUser(verified);
    });
    if (!result) throw new AppError("The code is invalid or no longer usable.", 401, "INVALID_OTP");
    return { token, expiresAt, user: result };
  }
}
