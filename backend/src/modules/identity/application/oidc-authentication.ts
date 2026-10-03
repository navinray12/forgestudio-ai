import { randomUUID } from "node:crypto";
import type { IdentityStorePort, LoginChallenge } from "../../../platform/ports/identity-store.port.js";
import type { IdentityProviderPort } from "../../../platform/ports/identity-provider.port.js";
import { AppError } from "../../../utils/app-error.js";
import { digest, opaqueToken, proofDigest, safeEqual, requireUsableUser, publicUser, invalidAuthentication, SESSION_TTL_MS } from "../domain/security-policy.js";

function authorizationProof(secret: string, id: string) {
  return { state: proofDigest(secret, `state:${id}`), nonce: proofDigest(secret, `nonce:${id}`), verifier: proofDigest(secret, `pkce:${id}`) };
}
export class OidcAuthentication {
  constructor(private readonly store: IdentityStorePort, private readonly provider: IdentityProviderPort,
    private readonly now: () => Date = () => new Date()) {}
  get callbackUrl() { return this.provider.callbackUrl; }
  async begin(link?: { userId: string; sessionId: string }, audience: "TENANT" | "PLATFORM" = "TENANT") {
    const secret = opaqueToken(); const now = this.now();
    const row: LoginChallenge = { id: randomUUID(), userId: link?.userId ?? null, kind: audience === "PLATFORM" ? "OIDC_PLATFORM" : "OIDC",
      secretHash: digest(secret), status: "PENDING", authEpoch: 0, email: null, otpHash: null,
      attempts: 0, expiresAt: new Date(now.getTime() + 5 * 60_000), lastSentAt: null, createdAt: now,
      providerKey: this.provider.key, initiatingSessionId: link?.sessionId ?? null };
    const url = await this.provider.authorizationUrl(authorizationProof(secret, row.id));
    await this.store.transaction(async tx => {
      if (link) {
        const user = await tx.lockUser(link.userId); requireUsableUser(user);
        if (!user.emailVerified || !await tx.currentSession(link.sessionId, user.id, user.authEpoch, now)) throw invalidAuthentication();
        row.authEpoch = user.authEpoch;
      }
      await tx.createChallenge(row);
    });
    return { secret, url };
  }
  async finish(secretInput: unknown, callback: URL, currentSessionId?: string) {
    if (typeof secretInput !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(secretInput)) throw invalidAuthentication();
    const secret = secretInput;
    const row = await this.store.findChallenge(digest(secret));
    if (!row || !["OIDC", "OIDC_PLATFORM"].includes(row.kind) || row.providerKey !== this.provider.key) throw invalidAuthentication();
    const audience: "TENANT" | "PLATFORM" = row.kind === "OIDC_PLATFORM" ? "PLATFORM" : "TENANT";
    const proof = authorizationProof(secret, row.id);
    if (callback.searchParams.getAll("state").length !== 1 || !safeEqual(callback.searchParams.get("state") ?? "", proof.state) ||
        callback.searchParams.getAll("code").length !== 1 || (callback.searchParams.get("code")?.length ?? 0) > 4096) throw invalidAuthentication();
    await this.store.transaction(async tx => {
      // Same user -> challenge lock order used by all authentication commands.
      if (row.userId) {
        const user = await tx.lockUser(row.userId); requireUsableUser(user);
        if (row.initiatingSessionId !== currentSessionId || row.authEpoch !== user.authEpoch ||
            !await tx.currentSession(currentSessionId!, user.id, user.authEpoch, this.now())) throw invalidAuthentication();
      }
      const current = await tx.lockChallenge(row.id);
      if (!current || current.status !== "PENDING" || current.expiresAt <= this.now()) throw invalidAuthentication();
      await tx.updateChallenge(row.id, { status: "CONSUMED" });
    });
    // A failed or ambiguous token exchange requires a fresh sign-in, never blind code replay.
    const identity = await this.provider.exchange(callback, proof);
    const token = opaqueToken(); const now = this.now(); const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const user = await this.store.transaction(async tx => {
      const binding = await tx.findOidcIdentity(identity.issuer, identity.subject);
      let actor;
      if (row.userId) {
        actor = await tx.lockUser(row.userId); requireUsableUser(actor);
        if (row.authEpoch !== actor.authEpoch || !actor.emailVerified ||
            !await tx.currentSession(currentSessionId!, actor.id, actor.authEpoch, now) ||
            actor.email !== identity.email || (binding && binding.userId !== actor.id)) throw invalidAuthentication();
      } else if (binding) {
        actor = await tx.lockUser(binding.userId); requireUsableUser(actor);
      } else {
        // An email display string, even a verified one, is not permission to take
        // over an existing local identity. Linking requires BOTH authenticated identities.
        if (await tx.findUserByEmail(identity.email)) {
          throw new AppError("An existing account must be linked by its authenticated owner.", 409, "IDENTITY_LINK_REQUIRED");
        }
        actor = await tx.createManagedUser({ email: identity.email, fullName: identity.name });
      }
      const privileged = actor.role !== "USER" || await tx.hasAdministrationAuthority(actor.id);
      if (audience === "PLATFORM" && !["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(actor.role)) {
        throw new AppError("Platform control access is not permitted.", 403, "PLATFORM_ACCESS_DENIED");
      }
      if (privileged && identity.assurance === "none") throw new AppError("An approved MFA context is required.", 403, "MFA_REQUIRED");
      if ((actor.role !== "USER" || audience === "PLATFORM") && identity.assurance !== "phishing-resistant") {
        throw new AppError("Phishing-resistant authentication is required.", 403, "STRONG_MFA_REQUIRED");
      }
      if (!binding) {
        await tx.addOidcIdentity(actor.id, identity.issuer, identity.subject);
        await tx.audit(actor.id, "IDENTITY_PROVIDER_BOUND", `user:${actor.id}`);
      }
      await tx.createSession({ userId: actor.id, tokenHash: digest(token), expiresAt, authEpoch: actor.authEpoch,
        authMethod: "oidc", authTime: identity.authenticatedAt, assurance: identity.assurance,
        mfaVerifiedAt: identity.assurance === "none" ? null : identity.authenticatedAt, audience });
      await tx.audit(actor.id, "IDENTITY_LOGIN_COMPLETED", `challenge:${row.id}`, { method: "oidc", assurance: identity.assurance });
      return publicUser(actor);
    });
    return { token, expiresAt, user, audience };
  }
}
