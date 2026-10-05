import { prisma } from "../../config/prisma.js";

const db = prisma as any;

export interface SlaTarget {
  firstResponseMinutes: number;
  resolutionMinutes: number;
  firstResponseDue: Date;
  resolutionDue: Date;
}

export const DEFAULT_SLA_POLICY_RULES: Record<
  string,
  { firstResponseMinutes: number; resolutionMinutes: number }
> = {
  CRITICAL: { firstResponseMinutes: 15, resolutionMinutes: 240 }, // 15m response, 4h resolution
  URGENT: { firstResponseMinutes: 30, resolutionMinutes: 480 }, // 30m response, 8h resolution
  HIGH: { firstResponseMinutes: 120, resolutionMinutes: 1440 }, // 2h response, 24h resolution
  NORMAL: { firstResponseMinutes: 480, resolutionMinutes: 2880 }, // 8h response, 48h resolution
  LOW: { firstResponseMinutes: 1440, resolutionMinutes: 7200 }, // 24h response, 5 days resolution
};

export async function calculateSlaTarget(
  priority: string,
  createdAt: Date = new Date(),
  slaPolicyId?: string
): Promise<SlaTarget> {
  let rule = DEFAULT_SLA_POLICY_RULES[priority] || DEFAULT_SLA_POLICY_RULES.NORMAL;

  if (slaPolicyId) {
    try {
      const dbPolicy = await db.supportSlaPolicy.findUnique({
        where: { id: slaPolicyId },
      });
      if (dbPolicy && dbPolicy.isActive) {
        rule = {
          firstResponseMinutes: dbPolicy.firstResponseMinutes,
          resolutionMinutes: dbPolicy.resolutionMinutes,
        };
      }
    } catch {}
  }

  const firstResponseDue = new Date(createdAt.getTime() + rule.firstResponseMinutes * 60 * 1000);
  const resolutionDue = new Date(createdAt.getTime() + rule.resolutionMinutes * 60 * 1000);

  return {
    firstResponseMinutes: rule.firstResponseMinutes,
    resolutionMinutes: rule.resolutionMinutes,
    firstResponseDue,
    resolutionDue,
  };
}

export function getSlaStatus(ticket: {
  createdAt: Date;
  firstResponseAt?: Date | null;
  resolvedAt?: Date | null;
  priority: string;
}): {
  status: "ON_TRACK" | "WARNING" | "BREACHED" | "COMPLETED";
  firstResponseDue: Date;
  resolutionDue: Date;
  isFirstResponseBreached: boolean;
  isResolutionBreached: boolean;
} {
  const rule = DEFAULT_SLA_POLICY_RULES[ticket.priority] || DEFAULT_SLA_POLICY_RULES.NORMAL;
  const createdAt = new Date(ticket.createdAt);
  const firstResponseDue = new Date(createdAt.getTime() + rule.firstResponseMinutes * 60 * 1000);
  const resolutionDue = new Date(createdAt.getTime() + rule.resolutionMinutes * 60 * 1000);

  const now = new Date();
  const firstResponseTime = ticket.firstResponseAt ? new Date(ticket.firstResponseAt) : null;
  const resolutionTime = ticket.resolvedAt ? new Date(ticket.resolvedAt) : null;

  const isFirstResponseBreached = firstResponseTime
    ? firstResponseTime > firstResponseDue
    : now > firstResponseDue;

  const isResolutionBreached = resolutionTime
    ? resolutionTime > resolutionDue
    : now > resolutionDue;

  if (resolutionTime) {
    return {
      status: isResolutionBreached ? "BREACHED" : "COMPLETED",
      firstResponseDue,
      resolutionDue,
      isFirstResponseBreached,
      isResolutionBreached,
    };
  }

  if (isFirstResponseBreached || isResolutionBreached) {
    return {
      status: "BREACHED",
      firstResponseDue,
      resolutionDue,
      isFirstResponseBreached,
      isResolutionBreached,
    };
  }

  // Warning if within 20% of resolution due time
  const totalResolutionMs = rule.resolutionMinutes * 60 * 1000;
  const remainingMs = resolutionDue.getTime() - now.getTime();
  if (remainingMs > 0 && remainingMs / totalResolutionMs <= 0.2) {
    return {
      status: "WARNING",
      firstResponseDue,
      resolutionDue,
      isFirstResponseBreached,
      isResolutionBreached,
    };
  }

  return {
    status: "ON_TRACK",
    firstResponseDue,
    resolutionDue,
    isFirstResponseBreached,
    isResolutionBreached,
  };
}

export async function getOrCreateDefaultSlaPolicies() {
  const existing = await db.supportSlaPolicy.findMany();
  if (existing.length > 0) return existing;

  const created = [];
  for (const [prio, rule] of Object.entries(DEFAULT_SLA_POLICY_RULES)) {
    const pol = await db.supportSlaPolicy.create({
      data: {
        name: `${prio} Priority Policy`,
        priority: prio as any,
        firstResponseMinutes: rule.firstResponseMinutes,
        resolutionMinutes: rule.resolutionMinutes,
        businessHoursEnabled: false,
        isActive: true,
      },
    });
    created.push(pol);
  }
  return created;
}
