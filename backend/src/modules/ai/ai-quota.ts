import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

export interface QuotaReservationOptions {
  workspaceId?: string | null;
  actorId?: string | null;
  units: number;
  dailyUnitsLimit?: number;
}

/**
 * Standard daily units limit if not customized per workspace/tier.
 * Synchronized with Phase 0 designConfig default.
 */
export function getDailyUnitsLimit(): number {
  return Number(process.env.AI_DESIGN_DAILY_UNITS || process.env.AI_DAILY_UNITS || 100);
}

/**
 * Atomically reserve AI quota units for a workspace or actor.
 * Follows the proven Phase 0 transaction pattern:
 * 1. Locks the workspace row: SELECT id FROM workspaces ... FOR UPDATE (if workspaceId is present)
 * 2. Sums all active reservations for the current UTC day
 * 3. Rejects with 429 AI_QUOTA_EXCEEDED if limit would be breached
 */
export async function reserveWorkspaceAiQuota(
  tx: any,
  options: QuotaReservationOptions
): Promise<{ reservedUnits: number; startOfDay: Date }> {
  const { workspaceId, actorId, units } = options;
  if (units <= 0) {
    throw new AppError("Reserved quota units must be greater than zero", 400, "INVALID_QUOTA_UNITS");
  }

  // Start of current UTC day
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  if (workspaceId) {
    // 1. Atomic row lock on the workspace to serialize concurrent admissions
    await tx.$queryRaw`SELECT id FROM workspaces WHERE id=${workspaceId}::uuid FOR UPDATE`;

    // 2. Aggregate active reservations for today by workspace
    const usage = await tx.aiExecution.aggregate({
      where: {
        workspaceId,
        createdAt: { gte: startOfDay },
        status: { notIn: ["FAILED", "CANCELLED", "RECONCILIATION_REQUIRED"] },
      },
      _sum: { reservedUnits: true },
    });

    const currentReserved = usage._sum.reservedUnits ?? 0;
    const limit = options.dailyUnitsLimit ?? getDailyUnitsLimit();

    if (currentReserved + units > limit) {
      throw new AppError("Workspace AI generation quota reached", 429, "AI_QUOTA_EXCEEDED");
    }
  } else if (actorId) {
    // 3. Fallback: Aggregate active reservations for today by actor for personal websites
    const usage = await tx.aiExecution.aggregate({
      where: {
        actorId,
        createdAt: { gte: startOfDay },
        status: { notIn: ["FAILED", "CANCELLED", "RECONCILIATION_REQUIRED"] },
      },
      _sum: { reservedUnits: true },
    });

    const currentReserved = usage._sum.reservedUnits ?? 0;
    const limit = options.dailyUnitsLimit ?? getDailyUnitsLimit();

    if (currentReserved + units > limit) {
      throw new AppError("User AI generation quota reached", 429, "AI_QUOTA_EXCEEDED");
    }
  }

  return { reservedUnits: units, startOfDay };
}

/**
 * Release reserved quota immediately on failure or cancellation (zero quota leakage).
 */
export async function releaseAiExecutionQuota(
  executionId: string,
  status: "FAILED" | "CANCELLED",
  errorCode?: string
): Promise<void> {
  await prisma.aiExecution.update({
    where: { id: executionId },
    data: {
      status,
      errorCode: errorCode ? errorCode.slice(0, 100) : undefined,
      reservedUnits: 0,
      completedAt: new Date(),
    },
  });
}

/**
 * Settle quota on successful completion.
 */
export async function settleAiExecutionQuota(
  tx: any,
  executionId: string,
  finalUnits: number,
  outputSummary?: any
): Promise<void> {
  await tx.aiExecution.update({
    where: { id: executionId },
    data: {
      status: "COMPLETED",
      reservedUnits: finalUnits,
      outputSummary,
      completedAt: new Date(),
    },
  });
}
