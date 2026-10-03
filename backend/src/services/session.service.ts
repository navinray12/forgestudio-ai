import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
export async function createUserSession(_userId: string): Promise<{ token: string; expiresAt: Date }> {
  throw new AppError("A verified authentication transaction is required.", 410, "UNBOUND_SESSION_RETIRED");
}
export async function createSupportSession(_userId: string, _durationMinutes = 120): Promise<never> {
  throw new AppError("Use scoped support grants.", 410, "SUPPORT_TOKEN_RETIRED");
}
export async function revokeSupportSessions(userId: string) {
  return prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
