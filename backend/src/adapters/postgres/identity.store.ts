import { AppError } from "../../utils/app-error.js";
import { prisma } from "../../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { IdentityStorePort, IdentityTransaction, IdentityUser, LoginChallenge, NewIdentitySession } from "../../platform/ports/identity-store.port.js";

class PostgresIdentityTransaction implements IdentityTransaction {
  constructor(private readonly tx: Prisma.TransactionClient) {}
  async findUserByEmail(email: string) { return this.tx.user.findUnique({ where: { email } }); }
  async findOidcIdentity(issuer: string, subject: string) {
    return this.tx.oidcIdentity.findUnique({ where: { issuer_subject: { issuer, subject } }, select: { userId: true } });
  }
  async addOidcIdentity(userId: string, issuer: string, subject: string) {
    await this.tx.oidcIdentity.create({ data: { userId, issuer, subject } });
  }
  async createManagedUser(input: { email: string; fullName: string | null }) {
    return this.tx.user.create({ data: { ...input, emailVerified: true, status: "ACTIVE", role: "USER" } });
  }
  async hasAdministrationAuthority(userId: string) {
    const organization = await this.tx.organizationMember.findFirst({
      where: { userId, role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
    if (organization) return true;
    const workspace = await this.tx.workspaceMember.findFirst({
      where: { userId, role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
    return !!workspace;
  }
  async currentSession(id: string, userId: string, epoch: number, now: Date, fresh = true) {
    return !!await this.tx.session.findFirst({ where: { id, userId, authEpoch: epoch, audience: "TENANT",
      authMethod: { in: process.env.NODE_ENV === "production" ? ["oidc"] : ["local", "oidc"] }, revokedAt: null, expiresAt: { gt: now },
      authTime: { ...(fresh ? { gte: new Date(now.getTime() - 15 * 60_000) } : {}), lte: new Date(now.getTime() + 60_000) } }, select: { id: true } });
  }
  async listSessions(userId: string, epoch: number, now: Date) {
    return this.tx.session.findMany({ where: { userId, authEpoch: epoch, audience: "TENANT",
      authMethod: { in: ["local", "oidc"] }, revokedAt: null, expiresAt: { gt: now } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
      select: { id: true, createdAt: true, expiresAt: true, lastUsedAt: true, authMethod: true } });
  }
  async findSession(userId: string, id: string) {
    return this.tx.session.findFirst({ where: { userId, id }, select: { id: true, userId: true, revokedAt: true } });
  }
  async findSessionByTokenHash(tokenHash: string) {
    return this.tx.session.findUnique({ where: { tokenHash }, select: { id: true, userId: true, revokedAt: true } });
  }
  async revokeSession(id: string, now: Date) { await this.tx.session.update({ where: { id }, data: { revokedAt: now } }); }
  async revokeAllSessions(userId: string, now: Date) {
    await this.tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  }
  async incrementAuthEpoch(userId: string) {
    await this.tx.user.update({ where: { id: userId }, data: { authEpoch: { increment: 1 } } });
  }
  async lockUser(id: string) {
    const rows = await this.tx.$queryRaw<IdentityUser[]>`SELECT * FROM users WHERE id=${id}::uuid FOR UPDATE`;
    return rows[0] ?? null;
  }
  async lockChallenge(id: string) {
    const rows = await this.tx.$queryRaw<LoginChallenge[]>`SELECT * FROM auth_challenges WHERE id=${id}::uuid FOR UPDATE`;
    return rows[0] ?? null;
  }
  async createUser(input: { id: string; email: string; fullName: string; passwordHash: string }) {
    return this.tx.user.create({ data: { ...input, role: "USER", status: "ACTIVE", verificationMethod: "EMAIL" } });
  }
  async createChallenge(challenge: LoginChallenge) { await this.tx.authChallenge.create({ data: challenge }); }
  async updateChallenge(id: string, fields: Partial<Pick<LoginChallenge, "status" | "otpHash" | "attempts" | "lastSentAt">>) {
    await this.tx.authChallenge.update({ where: { id }, data: fields });
  }
  async closeChallenges(userId: string, kind: string) {
    await this.tx.authChallenge.updateMany({ where: { userId, kind, status: { in: ["PENDING", "DELIVERING", "READY"] } },
      data: { status: "FAILED", otpHash: null } });
  }
  async lastDelivery(userId: string) {
    const row = await this.tx.authChallenge.findFirst({ where: { userId, lastSentAt: { not: null } },
      orderBy: { lastSentAt: "desc" }, select: { lastSentAt: true } });
    return row?.lastSentAt ?? null;
  }
  async markEmailVerified(userId: string) {
    return this.tx.user.update({ where: { id: userId }, data: { emailVerified: true, lastLoginAt: new Date() } });
  }
  async createSession(session: NewIdentitySession) {
    await this.tx.session.create({ data: { ...session, audience: "TENANT" } });
  }
  async audit(userId: string, action: string, resource: string, details: Record<string, string | number | boolean> = {}) {
    await this.tx.auditLog.create({ data: { userId, action, targetResource: resource, details } });
  }
}
export class PostgresIdentityStore implements IdentityStorePort {
  async findUserByEmail(email: string) { return prisma.user.findUnique({ where: { email } }); }
  async findChallenge(secretHash: string) { return prisma.authChallenge.findUnique({ where: { secretHash } }); }
  async transaction<T>(work: (tx: IdentityTransaction) => Promise<T>): Promise<T> {
    try {
      return await prisma.$transaction(tx => work(new PostgresIdentityTransaction(tx)), { maxWait: 2000, timeout: 5000 });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new AppError("An identity change conflicted. Start sign-in again.", 409, "IDENTITY_CONFLICT");
      }
      throw error;
    }
  }
  async consumeRateBucket(key: string, windowStart: Date, expiresAt: Date): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ attempts: number }>>`
      INSERT INTO identity_rate_buckets (key,"windowStart","expiresAt",attempts)
      VALUES (${key},${windowStart},${expiresAt},1)
      ON CONFLICT (key,"windowStart") DO UPDATE SET attempts=LEAST(identity_rate_buckets.attempts+1,1000000)
      RETURNING attempts`;
    return rows[0].attempts;
  }
}
