import { prisma } from "../../config/prisma.js";
/** Retention cleanup removes replay material but keeps non-sensitive operational metadata. */
export async function purgeExpiredAiPrompts(now = new Date()) {
  const result = await prisma.aiExecution.updateMany({ where: { promptExpiresAt: { lte: now }, promptCiphertext: { not: null } }, data: { promptCiphertext: null } });
  return result.count;
}
