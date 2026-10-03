import { createHash } from "node:crypto";
export interface OidcConfiguration {
  issuer: string; clientId: string; clientSecret: string; callbackUrl: string;
  allowedOrigins: string[]; mfaAcrs: string[]; phishingResistantAcrs: string[];
}
function absoluteUrl(value: string, httpsOnly = true): URL {
  const url = new URL(value);
  if (url.username || url.password || url.hash || url.search ||
      (httpsOnly ? url.protocol !== "https:" : !["https:", "http:"].includes(url.protocol))) throw new Error("INVALID_OIDC_URL");
  return url;
}
function values(value: string | undefined) {
  const result = (value ?? "").split(",").map(v => v.trim()).filter(Boolean);
  if (result.length > 20 || result.some(v => v.length > 256 || /\s/.test(v))) throw new Error("INVALID_OIDC_CONTEXTS");
  return [...new Set(result)];
}
export function loadOidcConfiguration(): OidcConfiguration | null {
  const { OIDC_ISSUER: issuer, OIDC_CLIENT_ID: clientId, OIDC_CLIENT_SECRET: clientSecret, OIDC_CALLBACK_URL: callbackUrl } = process.env;
  if (![issuer, clientId, clientSecret, callbackUrl].some(Boolean)) return null;
  if (!issuer || !clientId || !clientSecret || !callbackUrl || clientId.length > 512 || clientSecret.length > 8192) {
    throw new Error("INCOMPLETE_OIDC_CONFIGURATION");
  }
  const issuerUrl = absoluteUrl(issuer);
  const callback = absoluteUrl(callbackUrl, process.env.NODE_ENV === "production");
  if (callback.pathname !== "/api/v1/auth/oidc/callback") throw new Error("INVALID_OIDC_CALLBACK");
  const origins = values(process.env.OIDC_ALLOWED_ORIGINS);
  for (const origin of origins) if (absoluteUrl(origin).origin !== origin) throw new Error("INVALID_OIDC_ORIGIN");
  return { issuer: issuerUrl.href.replace(/\/$/, issuer.endsWith("/") ? "/" : ""), clientId, clientSecret, callbackUrl,
    allowedOrigins: [...new Set([issuerUrl.origin, ...origins])],
    mfaAcrs: values(process.env.OIDC_MFA_ACRS), phishingResistantAcrs: values(process.env.OIDC_PHISHING_RESISTANT_ACRS) };
}
export function oidcConfigurationKey(config: OidcConfiguration) {
  // Bind transient grants to one issuer, client and assurance policy; never hash or expose the secret.
  return createHash("sha256").update(JSON.stringify({issuer: config.issuer, clientId: config.clientId,
    callback: config.callbackUrl, mfa: config.mfaAcrs, strong: config.phishingResistantAcrs})).digest("hex");
}
