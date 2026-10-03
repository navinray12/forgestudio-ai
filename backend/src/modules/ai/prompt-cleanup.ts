import { prisma } from "../../config/prisma.js";
/** Retention cleanup removes replay material but keeps non-sensitive operational metadata. */
export async function purgeExpiredAiPrompts(now = new Date(), batchSize = 250) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000 || !Number.isFinite(now.getTime())) throw new Error("Invalid AI retention cleanup bounds");
  // Each worker claims a bounded batch. Expired rows remain eligible after a
  // crash; no in-memory schedule is the source of truth for retention eligibility.
  return prisma.$executeRaw`
    WITH expired AS (
      SELECT id FROM ai_executions
      WHERE "promptExpiresAt" <= ${now} AND "promptCiphertext" IS NOT NULL
      ORDER BY "promptExpiresAt", id LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
    )
    UPDATE ai_executions SET "promptCiphertext" = NULL
    FROM expired WHERE ai_executions.id = expired.id
  `;
}
