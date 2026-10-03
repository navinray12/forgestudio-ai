import { AppError } from "../../../utils/app-error.js";
type AssuranceSession = { authMethod: string; assurance: string; mfaVerifiedAt: Date | null; audience: string };
export function requireRecentMfa(session: AssuranceSession | undefined, strong = false, now = new Date(), audience: "TENANT" | "PLATFORM" = "TENANT") {
  const accepted = strong ? ["phishing-resistant"] : ["mfa", "phishing-resistant"];
  if (!session || session.authMethod !== "oidc" || session.audience !== audience ||
      !accepted.includes(session.assurance) || !session.mfaVerifiedAt ||
      now.getTime() - session.mfaVerifiedAt.getTime() > 15 * 60_000 ||
      session.mfaVerifiedAt.getTime() > now.getTime() + 60_000) {
    throw new AppError("Reauthenticate with the required multi-factor method.", 403, strong ? "STRONG_MFA_REQUIRED" : "MFA_REQUIRED");
  }
}
