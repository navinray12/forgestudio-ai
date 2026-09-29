export const AUTH_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-forge_session" : "forge_session";
export const AUTH_CHALLENGE_COOKIE = process.env.NODE_ENV === "production" ? "__Host-forge_challenge" : "forge_challenge";
export const PLATFORM_AUTH_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-forge_platform_session" : "forge_platform_session";
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
};
export const AUTH_CHALLENGE_OPTIONS = { ...AUTH_COOKIE_OPTIONS, maxAge: 10 * 60 * 1000 };

export function localAuthenticationEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && (process.env.FORGE_AUTH_MODE ?? "local") === "local";
}
export function browserOrigin(): string {
  const raw = process.env.FRONTEND_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173");
  const url = new URL(raw);
  if (url.origin !== raw || url.username || url.password ||
      !["https:", "http:"].includes(url.protocol) ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("INVALID_FRONTEND_ORIGIN");
  return url.origin;
}
