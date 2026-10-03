import { AppError } from "../utils/app-error.js";
export type OAuthProvider = "GOOGLE" | "GITHUB";
export interface OAuthProfile { provider: OAuthProvider; providerUserId: string; email: string | null; fullName: string | null; }
export async function loginWithOAuth(_profile: OAuthProfile): Promise<never> {
  throw new AppError("Use verified issuer/subject identity binding.", 410, "LEGACY_OAUTH_RETIRED");
}
