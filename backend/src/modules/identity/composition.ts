import { PostgresIdentityStore } from "../../adapters/postgres/identity.store.js";
import { SmtpOtpDelivery } from "../../adapters/identity/smtp-otp-delivery.js";
import { LocalOtpDelivery } from "../../adapters/identity/local-otp-delivery.js";
import { OpenIdProvider } from "../../adapters/identity/oidc.provider.js";
import { loadOidcConfiguration } from "../../adapters/identity/oidc.config.js";
import { browserOrigin } from "../../config/auth.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { LocalAuthentication } from "./application/local-authentication.js";
import { OidcAuthentication } from "./application/oidc-authentication.js";
import { AccountSessions } from "./application/account-sessions.js";

// This is the identity composition root. Domain/application code knows only ports.
export const identityStore = new PostgresIdentityStore();
const delivery = process.env.FORGE_LOCAL_OTP_FILE
  ? new LocalOtpDelivery(process.env.FORGE_LOCAL_OTP_FILE)
  : new SmtpOtpDelivery();
export const localAuthentication = new LocalAuthentication(identityStore,
  { hash: hashPassword, verify: verifyPassword }, delivery);
export const accountSessions = new AccountSessions(identityStore);
const config = loadOidcConfiguration();
export const oidcAuthentication = config ? new OidcAuthentication(identityStore, new OpenIdProvider(config)) : null;

export function validateIdentityConfiguration() {
  browserOrigin();
  const mode = process.env.FORGE_AUTH_MODE ?? (process.env.NODE_ENV === "production" ? "oidc" : "local");
  if (!["local", "oidc"].includes(mode) || (process.env.NODE_ENV === "production" && (mode !== "oidc" || !config ||
      !config.mfaAcrs.length || !config.phishingResistantAcrs.length))) throw new Error("PRODUCTION_MANAGED_IDENTITY_REQUIRED");
}
