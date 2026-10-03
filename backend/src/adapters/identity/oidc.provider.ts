import * as oidc from "openid-client";
import type { IdentityProviderPort, AuthorizationProof, VerifiedProviderIdentity } from "../../platform/ports/identity-provider.port.js";
import type { OidcConfiguration } from "./oidc.config.js";
import { oidcConfigurationKey } from "./oidc.config.js";
import { AppError } from "../../utils/app-error.js";

/** Discovery and token verification are delegated to the pinned OIDC library.
 * The application constrains egress, body sizes, redirects and assurance mapping.
 */
export class OpenIdProvider implements IdentityProviderPort {
  readonly key: string;
  readonly callbackUrl: string;
  private configuration: Promise<oidc.Configuration> | undefined;
  private retryAfter = 0;
  constructor(private readonly settings: OidcConfiguration, private readonly transport: typeof fetch = fetch) {
    this.key = oidcConfigurationKey(settings); this.callbackUrl = settings.callbackUrl;
  }
  private allowed(url: URL) {
    if (url.protocol !== "https:" || url.username || url.password || !this.settings.allowedOrigins.includes(url.origin)) {
      throw new Error("OIDC_DESTINATION_REJECTED");
    }
  }
  private boundedFetch: oidc.CustomFetch = async (url, init) => {
    this.allowed(new URL(url.toString()));
    const signals = [AbortSignal.timeout(5000)];
    if (init?.signal) signals.push(init.signal);
    const body = init.body instanceof Uint8Array ? new Uint8Array(init.body).buffer : init.body;
    const response = await this.transport(url, { ...init, body, redirect: "error", signal: AbortSignal.any(signals) });
    if (!response.body) return response;
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 256 * 1024) throw new Error("OIDC_RESPONSE_TOO_LARGE");
        chunks.push(value);
      }
      return new Response(Buffer.concat(chunks), { status: response.status, headers: response.headers });
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  };
  private async config() {
    if (Date.now() < this.retryAfter) throw new AppError("Sign-in provider is temporarily unavailable.", 503, "IDENTITY_PROVIDER_UNAVAILABLE");
    this.configuration ??= oidc.discovery(new URL(this.settings.issuer), this.settings.clientId,
      { id_token_signed_response_alg: "RS256" }, oidc.ClientSecretPost(this.settings.clientSecret),
      { timeout: 5, [oidc.customFetch]: this.boundedFetch, execute: [oidc.enableNonRepudiationChecks] })
      .then(config => {
        const metadata = config.serverMetadata();
        if (metadata.issuer !== this.settings.issuer || !metadata.code_challenge_methods_supported?.includes("S256")) {
          throw new Error("OIDC_METADATA_REJECTED");
        }
        for (const value of [metadata.authorization_endpoint, metadata.token_endpoint, metadata.jwks_uri]) {
          if (!value) throw new Error("OIDC_ENDPOINT_REQUIRED"); this.allowed(new URL(value));
        }
        return config;
      }).catch(() => {
        this.configuration = undefined; this.retryAfter = Date.now() + 30_000;
        throw new AppError("Sign-in provider is temporarily unavailable.", 503, "IDENTITY_PROVIDER_UNAVAILABLE");
      });
    return this.configuration;
  }
  async authorizationUrl(proof: AuthorizationProof): Promise<string> {
    const config = await this.config();
    const contexts = [...this.settings.phishingResistantAcrs, ...this.settings.mfaAcrs];
    return oidc.buildAuthorizationUrl(config, { redirect_uri: this.callbackUrl, scope: "openid email profile",
      response_type: "code", response_mode: "query", state: proof.state, nonce: proof.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(proof.verifier), code_challenge_method: "S256",
      max_age: "900", ...(contexts.length ? { acr_values: contexts.join(" ") } : {}) }).href;
  }
  async exchange(callback: URL, proof: AuthorizationProof): Promise<VerifiedProviderIdentity> {
    try {
      if (callback.origin + callback.pathname !== this.callbackUrl) throw new Error("CALLBACK_MISMATCH");
      const config = await this.config();
      const tokens = await oidc.authorizationCodeGrant(config, callback, {
        pkceCodeVerifier: proof.verifier, expectedState: proof.state, expectedNonce: proof.nonce, maxAge: 900, idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims || typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255 ||
          claims.email_verified !== true || typeof claims.email !== "string" ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) || claims.email.length > 254 ||
          typeof claims.auth_time !== "number" || !Number.isFinite(claims.auth_time) ||
          claims.auth_time * 1000 > Date.now() + 60_000) throw new Error("IDENTITY_CLAIMS_REJECTED");
      const acr = typeof claims.acr === "string" ? claims.acr : "";
      const assurance = this.settings.phishingResistantAcrs.includes(acr) ? "phishing-resistant" :
        this.settings.mfaAcrs.includes(acr) ? "mfa" : "none";
      return { issuer: this.settings.issuer, subject: claims.sub, email: claims.email.trim().toLowerCase(), emailVerified: true,
        name: typeof claims.name === "string" ? claims.name.slice(0, 120) : null,
        authenticatedAt: new Date(claims.auth_time * 1000), assurance };
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 503) throw error;
      throw new AppError("Identity verification failed. Start sign-in again.", 401, "OIDC_VERIFICATION_FAILED");
    }
  }
}
