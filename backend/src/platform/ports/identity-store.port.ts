/** Global identity storage. Tenant data and roles remain application-owned. */
export interface IdentityUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  passwordHash: string | null;
  status: string;
  role: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  authEpoch: number;
}
export interface LoginChallenge {
  id: string;
  userId: string | null;
  kind: string;
  secretHash: string;
  authEpoch: number;
  status: string;
  email: string | null;
  otpHash: string | null;
  attempts: number;
  expiresAt: Date;
  lastSentAt: Date | null;
  createdAt: Date;
  providerKey: string | null;
  initiatingSessionId: string | null;
}
export interface NewIdentitySession {
  userId: string; tokenHash: string; expiresAt: Date; authEpoch: number;
  authMethod: string; authTime: Date; assurance: string; mfaVerifiedAt: Date | null;
  audience?: "TENANT" | "PLATFORM";
}
export interface AccountSessionSummary {
  id: string; createdAt: Date; expiresAt: Date; lastUsedAt: Date | null; authMethod: string;
}
export interface SessionReference { id: string; userId: string; revokedAt: Date | null }
export interface IdentityTransaction {
  findUserByEmail(email: string): Promise<IdentityUser | null>;
  findOidcIdentity(issuer: string, subject: string): Promise<{ userId: string } | null>;
  addOidcIdentity(userId: string, issuer: string, subject: string): Promise<void>;
  createManagedUser(input: { email: string; fullName: string | null }): Promise<IdentityUser>;
  hasAdministrationAuthority(userId: string): Promise<boolean>;
  currentSession(id: string, userId: string, epoch: number, now: Date, fresh?: boolean): Promise<boolean>;
  listSessions(userId: string, epoch: number, now: Date): Promise<AccountSessionSummary[]>;
  findSession(userId: string, id: string): Promise<SessionReference | null>;
  findSessionByTokenHash(hash: string): Promise<SessionReference | null>;
  revokeSession(id: string, now: Date): Promise<void>;
  revokeAllSessions(userId: string, now: Date): Promise<void>;
  incrementAuthEpoch(userId: string): Promise<void>;
  lockUser(id: string): Promise<IdentityUser | null>;
  lockChallenge(id: string): Promise<LoginChallenge | null>;
  createUser(input: { id: string; email: string; fullName: string; passwordHash: string }): Promise<IdentityUser>;
  createChallenge(challenge: LoginChallenge): Promise<void>;
  updateChallenge(id: string, fields: Partial<Pick<LoginChallenge, "status" | "otpHash" | "attempts" | "lastSentAt">>): Promise<void>;
  closeChallenges(userId: string, kind: string): Promise<void>;
  lastDelivery(userId: string): Promise<Date | null>;
  markEmailVerified(userId: string): Promise<IdentityUser>;
  createSession(session: NewIdentitySession): Promise<void>;
  audit(userId: string, action: string, resource: string, details?: Record<string, string | number | boolean>): Promise<void>;
}
export interface IdentityStorePort {
  findUserByEmail(email: string): Promise<IdentityUser | null>;
  findChallenge(secretHash: string): Promise<LoginChallenge | null>;
  transaction<T>(work: (tx: IdentityTransaction) => Promise<T>): Promise<T>;
  consumeRateBucket(key: string, windowStart: Date, expiresAt: Date): Promise<number>;
}
