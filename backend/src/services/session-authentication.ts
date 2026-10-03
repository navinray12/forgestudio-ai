import crypto from "crypto";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";

/** A cookie or bearer value is only a locator for durable current session state.
 * Legacy support tokens and pre-migration sessions are never accepted.
 */
export async function authenticateSession(token: unknown, expectedAudience: "TENANT" | "PLATFORM" = "TENANT") {
  if (typeof token !== "string" || !token || token.length > 4096 || token.startsWith("supp_")) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
  const now = new Date();
  if (!session || session.revokedAt || session.expiresAt <= now) return null;
  if (session.user.status !== "ACTIVE") throw new AppError("Account is not active", 403, "ACCOUNT_INACTIVE");
  if (!Number.isInteger(session.authEpoch) || session.authEpoch < 1 || session.authEpoch !== session.user.authEpoch ||
      session.audience !== expectedAudience || !session.authTime || session.authTime.getTime() > now.getTime() + 60_000 ||
      !["local", "oidc"].includes(session.authMethod)) return null;
  if (process.env.NODE_ENV === "production" && session.authMethod !== "oidc") return null;
  const cutoff = new Date(now.getTime() - 60_000);
  if (!session.lastUsedAt || session.lastUsedAt <= cutoff) {
    const touched = await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null, expiresAt: { gt: now },
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lte: cutoff } }],
      },
      data: { lastUsedAt: now },
    });
    if (touched.count === 0) {
      const current = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!current || current.revokedAt || current.expiresAt <= now || current.authEpoch !== current.user.authEpoch ||
          current.user.status !== "ACTIVE") return null;
    }
  }
  return session;
}
