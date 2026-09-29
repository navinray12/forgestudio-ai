import type { IdentityStorePort, IdentityTransaction } from "../../../platform/ports/identity-store.port.js";
import { requireUsableUser, invalidAuthentication, digest } from "../domain/security-policy.js";
import { AppError } from "../../../utils/app-error.js";

interface ActorSession { userId: string; sessionId: string }
export class AccountSessions {
  constructor(private readonly store: IdentityStorePort, private readonly now: () => Date = () => new Date()) {}
  private async authorize(tx: IdentityTransaction, actor: ActorSession) {
    const user = await tx.lockUser(actor.userId); requireUsableUser(user);
    if (!await tx.currentSession(actor.sessionId, user.id, user.authEpoch, this.now(), false)) throw invalidAuthentication();
    return user;
  }
  list(actor: ActorSession) {
    return this.store.transaction(async tx => {
      const user = await this.authorize(tx, actor);
      const sessions = await tx.listSessions(user.id, user.authEpoch, this.now());
      return sessions.map(session => ({ ...session, current: session.id === actor.sessionId }));
    });
  }
  revoke(actor: ActorSession, sessionId: string) {
    return this.store.transaction(async tx => {
      await this.authorize(tx, actor);
      const session = await tx.findSession(actor.userId, sessionId);
      if (!session) throw new AppError("Session not found.", 404, "SESSION_NOT_FOUND");
      if (!session.revokedAt) {
        await tx.revokeSession(session.id, this.now());
        await tx.audit(actor.userId, "IDENTITY_SESSION_REVOKED", `session:${session.id}`);
      }
    });
  }
  revokeAll(actor: ActorSession) {
    return this.store.transaction(async tx => {
      await this.authorize(tx, actor);
      await tx.incrementAuthEpoch(actor.userId);
      await tx.revokeAllSessions(actor.userId, this.now());
      await tx.audit(actor.userId, "IDENTITY_ALL_SESSIONS_REVOKED", `user:${actor.userId}`);
    });
  }
  async logout(token: unknown) {
    if (typeof token !== "string" || !token || token.length > 4096) return;
    await this.store.transaction(async tx => {
      const session = await tx.findSessionByTokenHash(digest(token));
      if (!session) return;
      // Logout also works for an expired/suspended identity; it cannot create authority.
      await tx.lockUser(session.userId);
      const current = await tx.findSession(session.userId, session.id);
      if (current && !current.revokedAt) {
        await tx.revokeSession(session.id, this.now());
        await tx.audit(session.userId, "IDENTITY_SESSION_REVOKED", `session:${session.id}`);
      }
    });
  }
}
